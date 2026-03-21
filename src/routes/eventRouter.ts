import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { requireAuth } from '../middleware/auth';
import { createEvent, deleteEvent, getEventById, getEventsByInviterId, getEventsByIds } from '../repositories/eventRepository';
import { createInvitationLink, getInvitationLinkByEventId } from '../repositories/invitationLinkRepository';
import { triggerGeneration, scheduleResponseWindow } from '../services/responseWindowScheduler';
import { sendNotificationEmails } from '../services/emailService';
import { getActivityOptionsByEventId, getActivityOptionById, markActivityOptionSelected } from '../repositories/activityOptionRepository';
import { updateEventStatus } from '../repositories/eventRepository';
import { getResponsesByEventId, getEventIdsRespondedByUser } from '../repositories/responseRepository';
import { getUserById } from '../repositories/userRepository';

export function createEventRouter(pool: Pool): Router {
  const router = Router();

  router.use(requireAuth);

  /**
   * POST /api/events
   * Create a new event with title and description.
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const { title, description } = req.body;

      const missingFields: string[] = [];
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        missingFields.push('title');
      }
      if (!description || typeof description !== 'string' || description.trim().length === 0) {
        missingFields.push('description');
      }

      if (missingFields.length > 0) {
        res.status(400).json({ error: 'missing_fields', fields: missingFields });
        return;
      }

      const now = new Date();
      const responseWindowEnd = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

      const event = await createEvent(pool, {
        inviter_id: userId,
        title: title.trim(),
        description: description.trim(),
        response_window_end: responseWindowEnd,
      });

      res.status(201).json(event);

      // Schedule auto-generation when response window expires (2 min)
      scheduleResponseWindow(event, { pool });
    } catch (error) {
      console.error('Error creating event:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to create event.' });
    }
  });

  /**
   * GET /api/events
   * Dashboard: return events created by user + events user responded to.
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;

      const created = await getEventsByInviterId(pool, userId);
      const joinedIds = await getEventIdsRespondedByUser(pool, userId);
      const filteredJoinedIds = joinedIds.filter((id) => !created.some((e) => e.id === id));
      const joined = await getEventsByIds(pool, filteredJoinedIds);

      const createdWithCounts = await Promise.all(
        created.map(async (event) => {
          const responses = await getResponsesByEventId(pool, event.id);
          let selected_activity = null;
          if (event.status === 'finalized') {
            const opts = await getActivityOptionsByEventId(pool, event.id);
            const sel = opts.find((o) => o.is_selected);
            if (sel) selected_activity = { title: sel.title, suggested_date: sel.suggested_date, suggested_time: sel.suggested_time };
          }
          return { ...event, respondent_count: responses.length, selected_activity };
        })
      );

      const joinedWithActivity = await Promise.all(
        joined.map(async (event) => {
          let selected_activity = null;
          if (event.status === 'finalized') {
            const opts = await getActivityOptionsByEventId(pool, event.id);
            const sel = opts.find((o) => o.is_selected);
            if (sel) selected_activity = { title: sel.title, suggested_date: sel.suggested_date, suggested_time: sel.suggested_time };
          }
          return { ...event, selected_activity };
        })
      );

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
  router.get('/:eventId', async (req: Request, res: Response) => {
    try {
      const event = await getEventById(pool, req.params.eventId);

      if (!event) {
        res.status(404).json({ error: 'not_found', message: 'Event not found.' });
        return;
      }

      res.json(event);
    } catch (error) {
      console.error('Error fetching event:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to fetch event.' });
    }
  });

  /**
   * POST /api/events/:eventId/link
   * Generate a unique invitation link for the event.
   */
  router.post('/:eventId/link', async (req: Request, res: Response) => {
    try {
      const event = await getEventById(pool, req.params.eventId);

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
      const event = await getEventById(pool, req.params.eventId);

      if (!event) {
        res.status(404).json({ error: 'not_found', message: 'Event not found.' });
        return;
      }

      if (event.inviter_id !== userId) {
        res.status(403).json({ error: 'forbidden', message: 'Only the inviter can trigger generation.' });
        return;
      }

      if (event.status !== 'collecting') {
        res.status(409).json({ error: 'invalid_status', message: `Cannot generate from status '${event.status}'.` });
        return;
      }

      const options = await triggerGeneration(event.id, { pool });
      res.json({ options });
    } catch (error) {
      console.error('Error triggering generation:', error);
      res.status(503).json({ error: 'generation_failed', message: 'Activity generation is temporarily unavailable. Please try again shortly.' });
    }
  });

  /**
   * GET /api/events/:eventId/options
   * Return generated activity options for the event.
   */
  router.get('/:eventId/options', async (req: Request, res: Response) => {
    try {
      const event = await getEventById(pool, req.params.eventId);

      if (!event) {
        res.status(404).json({ error: 'not_found', message: 'Event not found.' });
        return;
      }

      const options = await getActivityOptionsByEventId(pool, req.params.eventId);
      res.json({ options });
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

      const event = await getEventById(pool, req.params.eventId);

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

      const option = await getActivityOptionById(pool, activityOptionId);

      if (!option || option.event_id !== event.id) {
        res.status(404).json({ error: 'not_found', message: 'Activity option not found for this event.' });
        return;
      }

      await markActivityOptionSelected(pool, activityOptionId);
      const updatedEvent = await updateEventStatus(pool, event.id, 'finalized');

      // Send notification emails to all participants
      sendNotificationEmails(pool, event.id).catch((err) =>
        console.error('Failed to send notification emails:', err)
      );

      res.json({ event: updatedEvent, selectedOption: { ...option, is_selected: true } });
    } catch (error) {
      console.error('Error selecting activity option:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to select activity option.' });
    }
  });

  /**
   * DELETE /api/events/:eventId
   * Delete an event (Inviter only). Cascade removes related records.
   */
  router.delete('/:eventId', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const event = await getEventById(pool, req.params.eventId);

      if (!event) {
        res.status(404).json({ error: 'not_found', message: 'Event not found.' });
        return;
      }

      if (event.inviter_id !== userId) {
        res.status(403).json({ error: 'forbidden', message: 'Only the inviter can delete this event.' });
        return;
      }

      await deleteEvent(pool, event.id);
      res.json({ deleted: true });
    } catch (error) {
      console.error('Error deleting event:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to delete event.' });
    }
  });

  /**
   * GET /api/events/:eventId/respondents
   * Return list of respondents for an event (inviter only).
   */
  router.get('/:eventId/respondents', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const event = await getEventById(pool, req.params.eventId);
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
