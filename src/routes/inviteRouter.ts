import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { getInvitationLinkByToken } from '../repositories/invitationLinkRepository';
import { getEventById } from '../repositories/eventRepository';
import { notifyEventInvited } from '../services/notificationService';

/**
 * Public router for resolving invitation links.
 * No auth required — this is the entry point for invitees.
 */
export function createInviteRouter(pool: Pool): Router {
  const router = Router();

  /**
   * GET /api/invite/:linkToken
   * Resolve an invitation token to its event.
   * Unauthenticated users get a redirect hint to auth first.
   */
  router.get('/:linkToken', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invitationLink = await getInvitationLinkByToken(pool, (req.params.linkToken as string));

      if (!invitationLink) {
        res.status(404).json({ error: 'invalid_link', message: 'This invitation link is not valid.' });
        return;
      }

      const event = await getEventById(pool, invitationLink.event_id);

      if (!event) {
        res.status(404).json({ error: 'not_found', message: 'Event not found.' });
        return;
      }

      // Check if user is authenticated (via x-user-id header in stub auth)
      const userId = req.headers['x-user-id'] as string | undefined;

      if (!userId) {
        // Redirect unauthenticated users to auth, with a return URL
        res.status(401).json({
          error: 'auth_required',
          message: 'Please log in to respond to this invitation.',
          redirect: `/?auth=1&returnTo=/invite/${(req.params.linkToken as string)}`,
          eventId: event.id,
        });
        return;
      }

      // Authenticated user — return event details
      res.json({
        eventId: event.id,
        title: event.title,
        description: event.description,
        status: event.status,
      });

      // Create notification for the invitee
      notifyEventInvited(pool, event.id, userId, event.title, (req.params.linkToken as string)).catch((err) =>
        console.error('Failed to create invite notification:', err)
      );
    } catch (error) {
      next(error);
    }
  });

  return router;
}
