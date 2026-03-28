import { Pool } from 'pg';
import { Event } from '../models/Event';
import { getResponsesByEventId } from '../repositories/responseRepository';
import { getTasteBenchmarkByUserId } from '../repositories/tasteBenchmarkRepository';
import { createActivityOption } from '../repositories/activityOptionRepository';
import { getEventById, updateEventStatus } from '../repositories/eventRepository';
import { getUserById } from '../repositories/userRepository';
import { generateActivityOptions, GeneratedOption, ParticipantAvailability } from './decisionAgent';
import { sendNotificationEmails } from './emailService';
import { getActivityOptionsByEventId, markActivityOptionSelected } from '../repositories/activityOptionRepository';
import { fetchRealWorldContext } from './realWorldData';
import { GeoLocation } from './realWorldData/types';
import { notifyOptionsReady } from './notificationService';
import { insertGenerationLog, finalizeGenerationLog } from '../repositories/generationLogRepository';

// Track active timers so they can be cancelled
const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

export interface SchedulerDeps {
  pool: Pool;
  apiKey?: string;
  model?: string;
  provider?: string;
}

/**
 * Schedule the response window expiry handler for an event.
 * At expiry, triggers generation with whatever context is available.
 */
export function scheduleResponseWindow(
  event: Event,
  deps: SchedulerDeps
): void {
  const now = Date.now();
  const expiryTime = new Date(event.response_window_end).getTime();
  const delay = Math.max(0, expiryTime - now);

  const timer = setTimeout(() => {
    activeTimers.delete(event.id);
    handleWindowExpiry(event.id, deps).catch((err) => {
      console.error(`Response window handler failed for event ${event.id}:`, err);
    });
  }, delay);

  // Store timer so it can be cancelled on early trigger
  activeTimers.set(event.id, timer);
}

/**
 * Cancel a scheduled response window timer for an event.
 */
export function cancelScheduledTimer(eventId: string): boolean {
  const timer = activeTimers.get(eventId);
  if (timer) {
    clearTimeout(timer);
    activeTimers.delete(eventId);
    return true;
  }
  return false;
}

/**
 * Early trigger: called when all invitees have responded before the window expires.
 * Cancels the scheduled timer. Generation is now manual-only via the organizer.
 */
export async function triggerEarly(
  eventId: string,
  _deps: SchedulerDeps
): Promise<void> {
  cancelScheduledTimer(eventId);
}

/**
 * Handle response window expiry. Generation is now manual-only via the organizer,
 * so this is a no-op — the event stays in 'collecting' until the organizer clicks
 * "Generate now".
 */
export async function handleWindowExpiry(
  eventId: string,
  deps: SchedulerDeps
): Promise<void> {
  const { pool } = deps;

  const event = await getEventById(pool, eventId);
  if (!event || event.status !== 'collecting') {
    return; // Event already processed or doesn't exist
  }

  // No-op: organizer triggers generation manually
}

/**
 * Trigger activity option generation for an event.
 * Collects taste benchmarks and available dates, calls the decision agent,
 * stores the generated options, and updates event status.
 */
export async function triggerGeneration(
  eventId: string,
  deps: SchedulerDeps
): Promise<GeneratedOption[]> {
  const { pool, apiKey, model, provider } = deps;

  // Fetch event for context (title/description)
  const event = await getEventById(pool, eventId);
  if (!event) {
    throw new Error(`Event ${eventId} not found for generation.`);
  }

  // Use user's custom API key/model/provider if not overridden by deps
  let effectiveApiKey = apiKey;
  let effectiveModel = model;
  let effectiveProvider = provider;
  if (!effectiveApiKey || !effectiveModel || !effectiveProvider) {
    const inviter = await getUserById(pool, event.inviter_id);
    if (!effectiveApiKey && inviter?.ai_api_key) {
      effectiveApiKey = inviter.ai_api_key;
    }
    if (!effectiveModel && inviter?.ai_model) {
      effectiveModel = inviter.ai_model;
    }
    if (!effectiveProvider && inviter?.ai_provider) {
      effectiveProvider = inviter.ai_provider;
    }
  }

  // Transition to generating
  await updateEventStatus(pool, eventId, 'generating');

  const wallStart = Date.now();
  const logEntry = await insertGenerationLog(pool, {
    event_id: eventId,
    model_used: effectiveModel ?? null,
    provider_used: effectiveProvider ?? null,
    attempt_number: 1,
  });
  console.log(`[GEN] Generation started — event: ${eventId}, model: ${effectiveModel ?? 'default'}, provider: ${effectiveProvider ?? 'openrouter'}, log: ${logEntry.id}`);

  let realWorldMs: number | null = null;
  let agentMs: number | null = null;

  try {
    const responses = await getResponsesByEventId(pool, eventId);
    console.log(`[GEN] Loaded ${responses.length} response(s) for event ${eventId}`);

    // Fetch all benchmarks in parallel instead of sequentially
    const benchmarkResults = await Promise.all(
      responses.map((r) => getTasteBenchmarkByUserId(pool, r.invitee_id))
    );
    const benchmarks = benchmarkResults.filter(
      (b): b is NonNullable<typeof b> => b !== null && b !== undefined
    );
    console.log(`[GEN] ${benchmarks.length}/${responses.length} participant(s) have taste benchmarks`);

    // Build per-participant availability with time windows
    const participantAvailability: ParticipantAvailability[] = responses.map((r, i) => ({
      participant_index: i + 1,
      windows: r.available_dates,
    }));

    // Build event context for the prompt
    const eventContext = event
      ? { title: event.title, description: event.description }
      : undefined;

    // Fetch real-world data if event has location
    let realWorldContext;
    if (event?.location_lat && event?.location_lng && event?.location_city) {
      const location: GeoLocation = {
        latitude: event.location_lat,
        longitude: event.location_lng,
        city: event.location_city,
        country: event.location_country ?? 'DE',
      };

      // Determine date range from participant availability, fallback to next 14 days
      const allDates = participantAvailability.flatMap((pa) =>
        pa.windows.map((w) => w.date)
      );
      const sortedDates = [...new Set(allDates)].sort();
      let startDate = sortedDates[0];
      let endDate = sortedDates[sortedDates.length - 1];

      if (!startDate || !endDate) {
        const now = new Date();
        startDate = now.toISOString().split('T')[0];
        const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        endDate = twoWeeks.toISOString().split('T')[0];
      }

      console.log(`[GEN] Fetching real-world data for ${event.location_city} (${startDate} → ${endDate})…`);
      const rwStart = Date.now();
      try {
        realWorldContext = await fetchRealWorldContext(
          location,
          startDate,
          endDate,
          benchmarks
        );
        realWorldMs = Date.now() - rwStart;
        console.log(
          `[GEN] Real-world data fetched in ${realWorldMs}ms — ${realWorldContext.events.length} event(s), ${realWorldContext.venues.length} venue(s), ${realWorldContext.weather.length} weather day(s)`
        );
      } catch (err) {
        realWorldMs = Date.now() - rwStart;
        console.warn(`[GEN] Real-world data fetch failed after ${realWorldMs}ms, proceeding without:`, err);
      }
    } else {
      console.log(`[GEN] No location set — skipping real-world data fetch`);
    }

    // Generate activity options using the user's configured AI provider
    console.log(`[GEN] Invoking planning agent…`);
    const agentStart = Date.now();
    const options = await generateActivityOptions(
      benchmarks,
      participantAvailability,
      effectiveApiKey,
      eventContext,
      realWorldContext,
      effectiveModel,
      effectiveProvider ?? undefined
    );
    agentMs = Date.now() - agentStart;
    console.log(`[GEN] Agent produced ${options.length} option(s) in ${agentMs}ms`);

    // Store generated options in parallel
    await Promise.all(
      options.map((option) =>
        createActivityOption(pool, {
          event_id: eventId,
          title: option.title,
          description: option.description,
          suggested_date: option.suggested_date,
          suggested_time: option.suggested_time,
          rank: option.rank,
          source_url: option.source_url,
          venue_name: option.venue_name,
          price_range: option.price_range,
          weather_note: option.weather_note,
          image_url: option.image_url ?? null,
        })
      )
    );

    const durationMs = Date.now() - wallStart;
    console.log(`[GEN] Options saved — transitioning to options_ready (total: ${durationMs}ms)`);

    // Transition to options_ready
    await updateEventStatus(pool, eventId, 'options_ready');

    await finalizeGenerationLog(pool, logEntry.id, {
      status: 'success',
      real_world_ms: realWorldMs,
      agent_ms: agentMs,
      duration_ms: durationMs,
      error_message: null,
    });

    // Notify organizer that options are ready
    notifyOptionsReady(pool, eventId, event.inviter_id, event.title).catch((err) =>
      console.error('Failed to send options_ready notification:', err)
    );

    return options;
  } catch (err) {
    const durationMs = Date.now() - wallStart;
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[GEN] Generation failed after ${durationMs}ms — reverting to collecting:`, errMsg);

    await finalizeGenerationLog(pool, logEntry.id, {
      status: 'failed',
      real_world_ms: realWorldMs,
      agent_ms: agentMs,
      duration_ms: durationMs,
      error_message: errMsg,
    }).catch(() => {/* don't mask the original error */});

    // Revert to collecting on failure so it can be retried
    await updateEventStatus(pool, eventId, 'collecting');
    throw err;
  }
}

/**
 * Get the number of active scheduled timers (useful for testing).
 */
export function getActiveTimerCount(): number {
  return activeTimers.size;
}

/**
 * Clear all active timers (useful for cleanup in tests).
 */
export function clearAllTimers(): void {
  for (const timer of activeTimers.values()) {
    clearTimeout(timer);
  }
  activeTimers.clear();
}
