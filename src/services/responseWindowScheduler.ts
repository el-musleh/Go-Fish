import { Pool } from 'pg';
import { Event } from '../models/Event';
import { getResponsesByEventId } from '../repositories/responseRepository';
import { getTasteBenchmarkByUserId } from '../repositories/tasteBenchmarkRepository';
import { createActivityOption } from '../repositories/activityOptionRepository';
import { getEventById, updateEventStatus } from '../repositories/eventRepository';
import { generateActivityOptions, GeneratedOption, ParticipantAvailability } from './decisionAgent';
import { sendNotificationEmails } from './emailService';
import { getActivityOptionsByEventId, markActivityOptionSelected } from '../repositories/activityOptionRepository';
import { fetchRealWorldContext } from './realWorldData';
import { GeoLocation } from './realWorldData/types';

const MIN_RESPONSES = 1;

// Track active timers so they can be cancelled
const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

export interface SchedulerDeps {
  pool: Pool;
  apiKey?: string;
}

/**
 * Schedule the response window expiry handler for an event.
 * At expiry, checks response count and either triggers generation or
 * marks the event as needing inviter decision.
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
 * Cancels the scheduled timer and immediately triggers generation.
 */
export async function triggerEarly(
  eventId: string,
  deps: SchedulerDeps
): Promise<void> {
  cancelScheduledTimer(eventId);
  await triggerGeneration(eventId, deps);
}

/**
 * Handle response window expiry.
 * If fewer than MIN_RESPONSES, mark event as needing inviter decision.
 * Otherwise, trigger activity generation.
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

  const responses = await getResponsesByEventId(pool, eventId);

  if (responses.length < MIN_RESPONSES) {
    // Mark event as awaiting inviter decision (extend or proceed)
    await updateEventStatus(pool, eventId, 'awaiting_decision' as any);
    console.log(
      `Event ${eventId}: fewer than ${MIN_RESPONSES} responses. Awaiting inviter decision.`
    );
    return;
  }

  await triggerGeneration(eventId, deps);
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
  const { pool, apiKey } = deps;

  // Fetch event for context (title/description)
  const event = await getEventById(pool, eventId);

  // Transition to generating
  await updateEventStatus(pool, eventId, 'generating');

  try {
    const responses = await getResponsesByEventId(pool, eventId);

    // Fetch all benchmarks in parallel instead of sequentially
    const benchmarkResults = await Promise.all(
      responses.map((r) => getTasteBenchmarkByUserId(pool, r.invitee_id))
    );
    const benchmarks = benchmarkResults.filter(
      (b): b is NonNullable<typeof b> => b !== null && b !== undefined
    );

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

      // Determine date range from participant availability
      const allDates = participantAvailability.flatMap((pa) =>
        pa.windows.map((w) => w.date)
      );
      const sortedDates = [...new Set(allDates)].sort();
      const startDate = sortedDates[0];
      const endDate = sortedDates[sortedDates.length - 1];

      if (startDate && endDate) {
        try {
          realWorldContext = await fetchRealWorldContext(
            location,
            startDate,
            endDate,
            benchmarks
          );
          console.log(
            `Event ${eventId}: fetched ${realWorldContext.events.length} events, ${realWorldContext.venues.length} venues, ${realWorldContext.weather.length} weather days`
          );
        } catch (err) {
          console.warn(`Event ${eventId}: real-world data fetch failed, proceeding without:`, err);
        }
      }
    }

    // Generate activity options via Gemini
    const options = await generateActivityOptions(
      benchmarks,
      participantAvailability,
      apiKey,
      eventContext,
      realWorldContext
    );

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
        })
      )
    );

    // Transition to options_ready
    await updateEventStatus(pool, eventId, 'options_ready');

    return options;
  } catch (err) {
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
