import { Pool } from 'pg';
import { Event } from '../models/Event';
import { getResponsesByEventId } from '../repositories/responseRepository';
import { getTasteBenchmarkByUserId } from '../repositories/tasteBenchmarkRepository';
import { createActivityOption } from '../repositories/activityOptionRepository';
import { getEventById, updateEventStatus } from '../repositories/eventRepository';
import { generateActivityOptions, GeneratedOption } from './decisionAgent';
import { sendNotificationEmails } from './emailService';
import { getActivityOptionsByEventId, markActivityOptionSelected } from '../repositories/activityOptionRepository';

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

  // Transition to generating
  await updateEventStatus(pool, eventId, 'generating');

  try {
    const responses = await getResponsesByEventId(pool, eventId);

    // Collect taste benchmarks for all respondents
    const benchmarks = [];
    const allDates = new Set<string>();

    for (const response of responses) {
      const benchmark = await getTasteBenchmarkByUserId(pool, response.invitee_id);
      if (benchmark) {
        benchmarks.push(benchmark);
      }
      for (const date of response.available_dates) {
        allDates.add(date);
      }
    }

    const availableDates = Array.from(allDates).sort();

    // Generate activity options via Gemini
    const options = await generateActivityOptions(benchmarks, availableDates, apiKey);

    // Store generated options
    for (const option of options) {
      await createActivityOption(pool, {
        event_id: eventId,
        title: option.title,
        description: option.description,
        suggested_date: option.suggested_date,
        rank: option.rank,
      });
    }

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
 * Auto-select the top-ranked option, finalize the event, and send emails.
 */
async function autoFinalizeAndNotify(eventId: string, deps: SchedulerDeps): Promise<void> {
  const { pool } = deps;
  try {
    const options = await getActivityOptionsByEventId(pool, eventId);
    const topOption = options.sort((a, b) => a.rank - b.rank)[0];
    if (topOption) {
      await markActivityOptionSelected(pool, topOption.id);
      await updateEventStatus(pool, eventId, 'finalized');
      await sendNotificationEmails(pool, eventId);
      console.log(`Event ${eventId}: auto-finalized with "${topOption.title}" and emails sent.`);
    }
  } catch (err) {
    console.error(`Event ${eventId}: auto-finalize failed:`, err);
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
