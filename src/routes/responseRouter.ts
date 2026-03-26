import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { createRequireAuth } from '../middleware/auth';
import { tasteBenchmarkGate } from '../middleware/tasteBenchmarkGate';
import { getEventById } from '../repositories/eventRepository';
import {
  createResponse,
  getResponsesByEventId,
  getResponseByEventAndInvitee,
} from '../repositories/responseRepository';

export function createResponseRouter(pool: Pool): Router {
  const router = Router({ mergeParams: true });
  const requireAuth = createRequireAuth(pool);

  /**
   * POST /api/events/:eventId/responses
   * Submit invitee response with available dates.
   * Requires auth + taste benchmark.
   */
  router.post(
    '/',
    requireAuth,
    tasteBenchmarkGate(pool),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as any).userId as string;
        const { eventId } = req.params;
        const { available_dates } = req.body;

        // Validate dates with time windows
        if (
          !available_dates ||
          !Array.isArray(available_dates) ||
          available_dates.length === 0
        ) {
          res.status(400).json({
            error: 'invalid_dates',
            message: 'At least one available date is required.',
          });
          return;
        }

        const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        for (const entry of available_dates) {
          if (typeof entry !== 'object' || !entry.date || !entry.start_time || !entry.end_time) {
            res.status(400).json({ error: 'invalid_dates', message: 'Each date must include date, start_time, and end_time.' });
            return;
          }
          if (!dateRegex.test(entry.date)) {
            res.status(400).json({ error: 'invalid_dates', message: 'Date must be in YYYY-MM-DD format.' });
            return;
          }
          if (!timeRegex.test(entry.start_time) || !timeRegex.test(entry.end_time)) {
            res.status(400).json({ error: 'invalid_dates', message: 'Times must be in HH:MM format.' });
            return;
          }
          if (entry.start_time >= entry.end_time) {
            res.status(400).json({ error: 'invalid_dates', message: 'start_time must be before end_time.' });
            return;
          }
        }

        // Check event exists
        const event = await getEventById(pool, eventId);
        if (!event) {
          res.status(404).json({ error: 'not_found', message: 'Event not found.' });
          return;
        }

        // Check response window is open
        const now = new Date();
        if (now > new Date(event.response_window_end)) {
          res.status(403).json({
            error: 'window_closed',
            message: 'The response period for this event has ended.',
          });
          return;
        }

        // Enforce one response per invitee per event
        const existing = await getResponseByEventAndInvitee(pool, eventId, userId);
        if (existing) {
          res.status(409).json({
            error: 'duplicate_response',
            message: 'You have already submitted a response for this event.',
          });
          return;
        }

        const response = await createResponse(pool, {
          event_id: eventId,
          invitee_id: userId,
          available_dates,
        });

        res.status(201).json(response);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/events/:eventId/responses
   * Return all responses for an event (Inviter only).
   */
  router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { eventId } = req.params;

      const event = await getEventById(pool, eventId);
      if (!event) {
        res.status(404).json({ error: 'not_found', message: 'Event not found.' });
        return;
      }

      // Only the inviter can view responses
      if (event.inviter_id !== userId) {
        res.status(403).json({
          error: 'forbidden',
          message: 'Only the event inviter can view responses.',
        });
        return;
      }

      const responses = await getResponsesByEventId(pool, eventId);
      res.json(responses);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
