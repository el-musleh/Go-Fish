import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { createRequireAuth } from '../middleware/auth';
import { createEvent, deleteEvent, getEventById, getEventsByInviterId, getEventsByIds } from '../repositories/eventRepository';
import { createInvitationLink, getInvitationLinkByEventId } from '../repositories/invitationLinkRepository';
import { triggerGeneration, scheduleResponseWindow } from '../services/responseWindowScheduler';
import { sendNotificationEmails } from '../services/emailService';
import { getActivityOptionsByEventId, getActivityOptionById, selectActivityOptionTx, getActivityOptionsForEvents } from '../repositories/activityOptionRepository';
import { updateEventStatus, saveEventSuggestions, closeResponseWindow, archiveEvent, transitionEventStatus, archiveExpiredEvents } from '../repositories/eventRepository';
import { getResponsesByEventId, getEventIdsRespondedByUser, getResponsesForEvents } from '../repositories/responseRepository';
import { getUserById, getUsersByIds } from '../repositories/userRepository';
import { generateEventSuggestions } from '../services/eventPreviewService';
import { notifyEventFinalized } from '../services/notificationService';
import { expireNotificationsForEvent } from '../repositories/notificationRepository';

// Simple geocoding: try Google Geocoding API, fall back to known cities
const KNOWN_CITIES: Record<string, { lat: number; lng: number }> = {
  berlin: { lat: 52.52, lng: 13.405 },
  hamburg: { lat: 53.5511, lng: 9.9937 },
  münchen: { lat: 48.1351, lng: 11.582 },
  munich: { lat: 48.1351, lng: 11.582 },
  köln: { lat: 50.9375, lng: 6.9603 },
  cologne: { lat: 50.9375, lng: 6.9603 },
  frankfurt: { lat: 50.1109, lng: 8.6821 },
  stuttgart: { lat: 48.7758, lng: 9.1829 },
  düsseldorf: { lat: 51.2277, lng: 6.7735 },
  leipzig: { lat: 51.3397, lng: 12.3731 },
  dresden: { lat: 51.0504, lng: 13.7373 },
  hannover: { lat: 52.3759, lng: 9.732 },
  nürnberg: { lat: 49.4521, lng: 11.0767 },
  bremen: { lat: 53.0793, lng: 8.8017 },
  wien: { lat: 48.2082, lng: 16.3738 },
  vienna: { lat: 48.2082, lng: 16.3738 },
  zürich: { lat: 47.3769, lng: 8.5417 },
  zurich: { lat: 47.3769, lng: 8.5417 },
};

async function geocodeCity(city: string): Promise<{ lat: number; lng: number } | null> {
  const known = KNOWN_CITIES[city.toLowerCase().trim()];
  if (known) return known;

  // Try Google Geocoding API
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city)}&key=${apiKey}`
    );
    const data = (await response.json()) as { results: Array<{ geometry: { location: { lat: number; lng: number } } }> };
    if (data.results?.[0]) {
      return { lat: data.results[0].geometry.location.lat, lng: data.results[0].geometry.location.lng };
    }
  } catch {
    // ignore geocoding failure
  }
  return null;
}

async function generateAndSave(pool: Pool, event: { id: string; inviter_id: string; title: string; description: string; location_city: string | null }) {
  const inviter = await getUserById(pool, event.inviter_id);
  const suggestions = await generateEventSuggestions({
    title: event.title,
    description: event.description,
    location_city: event.location_city,
  }, inviter?.ai_api_key ?? undefined, inviter?.ai_provider ?? undefined);
  await saveEventSuggestions(pool, event.id, suggestions);
  return suggestions;
}

async function autoArchivePastEvents(pool: Pool, events: any[]) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const toArchive: string[] = [];
  for (const event of events) {
    if (event.archived) continue;
    const eventDateStr = event.selected_activity?.suggested_date ?? event.preferred_date;
    if (!eventDateStr) continue;
    const eventDate = new Date(eventDateStr);
    eventDate.setHours(0, 0, 0, 0);
    if (eventDate < now) {
      toArchive.push(event.id);
      event.archived = true;
    }
  }

  // Single batch UPDATE instead of N individual queries
  if (toArchive.length > 0) {
    await archiveExpiredEvents(pool, toArchive);
  }
}

function normalizeActivityOptions<T extends { rank: number }>(options: T[]): T[] {
  const uniqueOptions: T[] = [];
  const seenRanks = new Set<number>();

  for (const option of [...options].sort((a, b) => a.rank - b.rank)) {
    if (seenRanks.has(option.rank) || uniqueOptions.length >= 3) continue;
    seenRanks.add(option.rank);
    uniqueOptions.push(option);
  }

  return uniqueOptions;
}

export function createEventRouter(pool: Pool): Router {
  const router = Router();
  const requireAuth = createRequireAuth(pool);

  router.use(requireAuth);

  /**
   * POST /api/events
   * Create a new event with title and description.
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { 
        title, 
        location_city, 
        location_country, 
        location_lat, 
        location_lng, 
        timeout_hours,
        preferred_date,
        preferred_time,
        duration_minutes
      } = req.body;
      const description: string = typeof req.body.description === 'string' ? req.body.description.trim() : '';

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        res.status(400).json({ error: 'missing_fields', fields: ['title'] });
        return;
      }

      const hours = typeof timeout_hours === 'number' && timeout_hours > 0 ? timeout_hours : 24;
      const now = new Date();
      const responseWindowEnd = new Date(now.getTime() + hours * 60 * 60 * 1000);

      // Auto-geocode city if no coordinates provided
      let lat = location_lat ?? null;
      let lng = location_lng ?? null;
      if (!lat && !lng && location_city) {
        const coords = await geocodeCity(location_city);
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
        }
      }

      const event = await createEvent(pool, {
        inviter_id: userId,
        title: title.trim(),
        description: description.trim(),
        response_window_end: responseWindowEnd,
        location_city: location_city ?? null,
        location_country: location_country ?? null,
        location_lat: lat,
        location_lng: lng,
        preferred_date: preferred_date ?? null,
        preferred_time: preferred_time ?? null,
        duration_minutes: duration_minutes ?? null,
      });

      res.status(201).json(event);

      // Schedule auto-generation when the response window expires.
      scheduleResponseWindow(event, { pool });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/events
   * Dashboard: return events created by user + events user responded to.
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      const userId = (req as any).userId as string;

      const created = await getEventsByInviterId(pool, userId);
      const joinedIds = await getEventIdsRespondedByUser(pool, userId);
      const filteredJoinedIds = joinedIds.filter((id) => !created.some((e) => e.id === id));
      const joined = filteredJoinedIds.length > 0 ? await getEventsByIds(pool, filteredJoinedIds) : [];

      const allEvents = [...created, ...joined];
      const allEventIds = allEvents.map((e) => e.id);

      // Three batch queries instead of N×3 per-event queries
      const [responsesMap, optionsMap, inviterMap] = await Promise.all([
        getResponsesForEvents(pool, allEventIds),
        getActivityOptionsForEvents(pool, allEventIds),
        getUsersByIds(pool, [...new Set(allEvents.map((e) => e.inviter_id))]),
      ]);

      function buildSelectedActivity(eventId: string) {
        const opts = optionsMap.get(eventId) ?? [];
        const sel = opts.find((o) => o.is_selected);
        return sel ? { title: sel.title, suggested_date: sel.suggested_date, suggested_time: sel.suggested_time } : null;
      }

      const createdWithCounts = created.map((event) => ({
        ...event,
        respondent_count: (responsesMap.get(event.id) ?? []).length,
        selected_activity: event.status === 'finalized' ? buildSelectedActivity(event.id) : null,
        inviter_email: inviterMap.get(event.inviter_id)?.email,
      }));

      const joinedWithActivity = joined.map((event) => ({
        ...event,
        selected_activity: event.status === 'finalized' ? buildSelectedActivity(event.id) : null,
        inviter_email: inviterMap.get(event.inviter_id)?.email,
      }));

      await autoArchivePastEvents(pool, createdWithCounts);
      await autoArchivePastEvents(pool, joinedWithActivity);

      res.json({ created: createdWithCounts, joined: joinedWithActivity });
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to fetch dashboard.' });
    }
  });

  /**
   * GET /api/events/:eventId
   * Return event details.
   */
  router.get('/:eventId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      const event = await getEventById(pool, (req.params.eventId as string));

      if (!event) {
        res.status(404).json({ error: 'not_found', message: 'Event not found.' });
        return;
      }

      const inviter = await getUserById(pool, event.inviter_id);
      res.json({ ...event, inviter_email: inviter?.email });
    } catch (error) {
      next(error);
    }

  });

  /**
   * GET /api/events/:eventId/suggestions
   * Return AI-generated event suggestions (venue, cost, duration, timing).
   * - Returns cached DB suggestions immediately if available.
   * - Returns { pending: true } if the response window is still open.
   * - Otherwise generates via AI, stores in DB, and returns.
   */
  router.get('/:eventId/suggestions', async (req: Request, res: Response) => {
    try {
      const event = await getEventById(pool, (req.params.eventId as string));
      if (!event) {
        res.status(404).json({ error: 'not_found', message: 'Event not found.' });
        return;
      }

      // Return DB-cached suggestions (shared across all users)
      if (event.ai_suggestions) {
        res.json(event.ai_suggestions);
        return;
      }

      // Don't generate while the response window is still open
      if (new Date(event.response_window_end) > new Date()) {
        res.json({ pending: true, response_window_end: event.response_window_end });
        return;
      }

      // Window closed — generate, cache in DB, return
      res.json(await generateAndSave(pool, event));
    } catch (error) {
      console.error('Error generating event suggestions:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to generate suggestions.' });
    }
  });

  /**
   * POST /api/events/:eventId/end-window
   * Organizer closes the response window early and triggers suggestion generation.
   */
  router.post('/:eventId/end-window', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const event = await getEventById(pool, (req.params.eventId as string));

      if (!event) {
        res.status(404).json({ error: 'not_found', message: 'Event not found.' });
        return;
      }
      if (event.inviter_id !== userId) {
        res.status(403).json({ error: 'forbidden', message: 'Only the organizer can close the response window.' });
        return;
      }
      if (event.ai_suggestions) {
        res.json(event.ai_suggestions);
        return;
      }

      await closeResponseWindow(pool, event.id);
      res.json(await generateAndSave(pool, event));
    } catch (error) {
      console.error('Error ending response window:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to generate suggestions.' });
    }
  });

  /**
   * POST /api/events/:eventId/close-window
   * Organizer manually closes the response window and marks the event as ready
   * without triggering AI suggestion generation.
   */
  router.post('/:eventId/close-window', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const event = await getEventById(pool, req.params.eventId as string);

      if (!event) {
        res.status(404).json({ error: 'not_found', message: 'Event not found.' });
        return;
      }
      if (event.inviter_id !== userId) {
        res.status(403).json({ error: 'forbidden', message: 'Only the organizer can close the response window.' });
        return;
      }
      if (event.status !== 'collecting') {
        res.status(409).json({ error: 'invalid_status', message: `Event is not in collecting status.` });
        return;
      }

      await closeResponseWindow(pool, event.id);
      const updated = await transitionEventStatus(pool, event.id, 'collecting', 'options_ready');
      res.json(updated ?? event);
    } catch (error) {
      console.error('Error closing response window:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to close response window.' });
    }
  });

  /**
   * POST /api/events/:eventId/link
   * Generate a unique invitation link for the event.
   */
  router.post('/:eventId/link', async (req: Request, res: Response) => {
    try {
      const event = await getEventById(pool, (req.params.eventId as string));

      if (!event) {
        res.status(404).json({ error: 'not_found', message: 'Event not found.' });
        return;
      }

      // Return existing link if one already exists for this event
      const existing = await getInvitationLinkByEventId(pool, event.id);
      if (existing) {
        res.json({ token: existing.token, link: `/api/invite/${existing.token}` });
        return;
      }

      const token = crypto.randomBytes(32).toString('base64url');

      const invitationLink = await createInvitationLink(pool, {
        event_id: event.id,
        token,
      });

      res.status(201).json({ token: invitationLink.token, link: `/api/invite/${invitationLink.token}` });
    } catch (error) {
      console.error('Error generating invitation link:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to generate invitation link.' });
    }
  });

  /**
   * POST /api/events/:eventId/generate
   * Manually trigger activity option generation (Inviter only).
   * Transitions status: collecting → generating → options_ready
   */
  router.post('/:eventId/generate', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const event = await getEventById(pool, (req.params.eventId as string));

      if (!event) {
        res.status(404).json({ error: 'not_found', message: 'Event not found.' });
        return;
      }

      if (event.inviter_id !== userId) {
        res.status(403).json({ error: 'forbidden', message: 'Only the inviter can trigger generation.' });
        return;
      }

      // Atomic status transition: only one concurrent request can win
      const transitioning = await transitionEventStatus(pool, event.id, 'collecting', 'generating');
      if (!transitioning) {
        // Either already transitioned by a concurrent request or status was not 'collecting'
        const current = await getEventById(pool, event.id);
        const currentStatus = current?.status ?? event.status;
        res.status(409).json({ error: 'invalid_status', message: `Cannot generate from status '${currentStatus}'.` });
        return;
      }

      const options = await triggerGeneration(event.id, { pool });
      res.json({ options: normalizeActivityOptions(options) });
    } catch (error) {
      console.error('Error triggering generation:', error);
      
      // Check if it's an API key / authentication error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isAuthError =
        errorMessage.includes('No AI API key') ||
        errorMessage.includes('API key') ||
        errorMessage.includes('Authentication') ||
        errorMessage.includes('authentication') ||
        errorMessage.includes('Unauthorized') ||
        errorMessage.includes('401');
      if (isAuthError) {
        res.status(503).json({
          error: 'NEEDS_API_KEY',
          message: 'AI generation requires a valid API key. Please check your API key in Settings → Infrastructure.',
          link: '/settings?tab=infrastructure'
        });
        return;
      }
      
      res.status(503).json({ error: 'generation_failed', message: 'Activity generation is temporarily unavailable. Please try again shortly.' });
    }
  });

  /**
   * GET /api/events/:eventId/options
   * Return generated activity options for the event.
   */
  router.get('/:eventId/options', async (req: Request, res: Response) => {
    try {
      const event = await getEventById(pool, (req.params.eventId as string));

      if (!event) {
        res.status(404).json({ error: 'not_found', message: 'Event not found.' });
        return;
      }

      const options = await getActivityOptionsByEventId(pool, (req.params.eventId as string));
      res.json({ options: normalizeActivityOptions(options) });
    } catch (error) {
      console.error('Error fetching activity options:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to fetch activity options.' });
    }
  });

  /**
   * POST /api/events/:eventId/select
   * Select an activity option for the event (Inviter only).
   * Transitions Event status to `finalized`.
   */
  router.post('/:eventId/select', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const { activityOptionId } = req.body;

      if (!activityOptionId) {
        res.status(400).json({ error: 'missing_fields', message: 'activityOptionId is required.' });
        return;
      }

      const event = await getEventById(pool, (req.params.eventId as string));

      if (!event) {
        res.status(404).json({ error: 'not_found', message: 'Event not found.' });
        return;
      }

      if (event.inviter_id !== userId) {
        res.status(403).json({ error: 'forbidden', message: 'Only the inviter can select an activity.' });
        return;
      }

      if (event.status === 'finalized') {
        res.status(409).json({ error: 'already_finalized', message: 'An activity has already been selected for this event.' });
        return;
      }

      if (event.status !== 'options_ready') {
        res.status(409).json({ error: 'invalid_status', message: `Cannot select from status '${event.status}'.` });
        return;
      }

      // Atomically mark the option selected and finalize the event in one transaction
      const client = await pool.connect();
      let updatedEvent;
      let selectedOption;
      try {
        await client.query('BEGIN');
        selectedOption = await selectActivityOptionTx(client, event.id, activityOptionId);
        if (!selectedOption) {
          await client.query('ROLLBACK');
          res.status(404).json({ error: 'not_found', message: 'Activity option not found for this event.' });
          return;
        }
        const { rows } = await client.query(
          `UPDATE event SET status = 'finalized' WHERE id = $1 RETURNING *`,
          [event.id]
        );
        updatedEvent = rows[0];
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      // Send notification emails to all participants
      sendNotificationEmails(pool, event.id).catch((err) =>
        console.error('Failed to send notification emails:', err)
      );

      // Notify participants that the event is finalized
      getResponsesByEventId(pool, event.id)
        .then((responses) => {
          const participantIds = responses.map((r) => r.invitee_id);
          if (participantIds.length > 0) {
            return notifyEventFinalized(pool, event.id, participantIds, event.title);
          }
          return [];
        })
        .catch((err) => console.error('Failed to notify participants:', err));

      res.json({ event: updatedEvent, selectedOption });
    } catch (error) {
      console.error('Error selecting activity option:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to select activity option.' });
    }
  });

  /**
   * DELETE /api/events/:eventId
   * Delete an event (Inviter only). Cascade removes related records.
   */
  router.delete('/:eventId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const event = await getEventById(pool, (req.params.eventId as string));

      if (!event) {
        res.status(404).json({ error: 'not_found', message: 'Event not found.' });
        return;
      }

      if (event.inviter_id !== userId) {
        res.status(403).json({ error: 'forbidden', message: 'Only the inviter can delete this event.' });
        return;
      }

      // Expire related notifications before deleting
      await expireNotificationsForEvent(pool, event.id);
      await deleteEvent(pool, event.id);
      res.json({ deleted: true });
    } catch (error) {
      next(error);
    }

  });

  /**
   * GET /api/events/:eventId/respondents
   * Return list of respondents for an event (inviter only).
   */
  router.get('/:eventId/respondents', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const event = await getEventById(pool, (req.params.eventId as string));
      if (!event) { res.status(404).json({ error: 'not_found' }); return; }
      if (event.inviter_id !== userId) { res.status(403).json({ error: 'forbidden' }); return; }

      const responses = await getResponsesByEventId(pool, event.id);
      const respondents = await Promise.all(
        responses.map(async (r) => {
          const user = await getUserById(pool, r.invitee_id);
          return { id: r.invitee_id, email: user?.email ?? 'Unknown', available_dates: r.available_dates, responded_at: r.created_at };
        })
      );
      res.json({ respondents });
    } catch (error) {
      console.error('Error fetching respondents:', error);
      res.status(500).json({ error: 'internal_error' });
    }
  });

  return router;
}