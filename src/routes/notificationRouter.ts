import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { createRequireAuth } from '../middleware/auth';
import {
  getNotifications,
  getRecentUnreadNotifications,
  getUnreadCount,
  getTotalCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getNotificationById,
} from '../repositories/notificationRepository';
import {
  getUserPreferences,
  updateUserPreferences,
  type UpdateUserPreferencesData,
} from '../repositories/userPreferencesRepository';
import { registerSSEClient, unregisterSSEClient } from '../services/notificationService';

export function createNotificationRouter(pool: Pool): Router {
  const router = Router();
  const requireAuth = createRequireAuth(pool);

  /**
   * GET /api/notifications/stream
   * SSE endpoint for real-time notifications
   */
  router.get('/stream', requireAuth, (req: Request, res: Response) => {
    const userId = (req as any).userId as string;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Register this client
    const client = {
      write: (data: string) => {
        try {
          res.write(data);
        } catch {
          // Client disconnected
        }
      },
      end: () => {
        try {
          res.end();
        } catch {
          // Already ended
        }
      },
    };

    registerSSEClient(userId, client);

    // Handle client disconnect
    req.on('close', () => {
      unregisterSSEClient(userId, client);
    });

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
        unregisterSSEClient(userId, client);
      }
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
    });
  });

  /**
   * GET /api/notifications
   * Get paginated notifications for the current user
   */
  router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));

      const [listResult, totalCount] = await Promise.all([
        getNotifications(pool, userId, page, limit),
        getTotalCount(pool, userId),
      ]);

      res.json({
        notifications: listResult.notifications,
        total: totalCount,
        page,
        limit,
        hasMore: listResult.hasMore,
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to fetch notifications' });
    }
  });

  /**
   * GET /api/notifications/recent
   * Get recent unread notifications (for bell icon - max 5)
   */
  router.get('/recent', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const limit = Math.min(5, Math.max(1, parseInt(req.query.limit as string) || 5));

      const notifications = await getRecentUnreadNotifications(pool, userId, limit);
      const unreadCount = await getUnreadCount(pool, userId);

      res.json({
        notifications,
        unreadCount,
        hasMore: unreadCount > limit,
      });
    } catch (error) {
      console.error('Error fetching recent notifications:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to fetch notifications' });
    }
  });

  /**
   * GET /api/notifications/unread-count
   * Get unread notification count
   */
  router.get('/unread-count', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const count = await getUnreadCount(pool, userId);
      res.json({ count });
    } catch (error) {
      console.error('Error fetching unread count:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to fetch count' });
    }
  });

  /**
   * PATCH /api/notifications/:id/read
   * Mark a single notification as read
   */
  router.patch('/:id/read', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const notificationId = req.params.id as string;

      // Verify ownership
      const notification = await getNotificationById(pool, notificationId);
      if (!notification) {
        res.status(404).json({ error: 'not_found', message: 'Notification not found' });
        return;
      }
      if (notification.user_id !== userId) {
        res.status(403).json({ error: 'forbidden', message: 'Cannot access this notification' });
        return;
      }

      const success = await markNotificationRead(pool, notificationId, userId);
      if (!success) {
        res.status(404).json({ error: 'not_found', message: 'Notification not found' });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to mark as read' });
    }
  });

  /**
   * POST /api/notifications/mark-all-read
   * Mark all notifications as read for the current user
   */
  router.post('/mark-all-read', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const count = await markAllNotificationsRead(pool, userId);
      res.json({ success: true, count });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to mark all as read' });
    }
  });

  /**
   * DELETE /api/notifications/:id
   * Delete a notification
   */
  router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const notificationId = req.params.id as string;

      const success = await deleteNotification(pool, notificationId, userId);
      if (!success) {
        res.status(404).json({ error: 'not_found', message: 'Notification not found' });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to delete notification' });
    }
  });

  /**
   * GET /api/notifications/preferences
   * Get user notification preferences
   */
  router.get('/preferences', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      let prefs = await getUserPreferences(pool, userId);

      // Create default preferences if none exist
      if (!prefs) {
        const { createDefaultUserPreferences } = await import('../repositories/userPreferencesRepository.js');
        prefs = await createDefaultUserPreferences(pool, userId);
      }

      res.json({
        email_on_event_confirmed: prefs!.email_on_event_confirmed,
        email_on_new_rsvp: prefs!.email_on_new_rsvp,
        email_on_options_ready: prefs!.email_on_options_ready,
      });
    } catch (error) {
      console.error('Error fetching user preferences:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to fetch preferences' });
    }
  });

  /**
   * PATCH /api/notifications/preferences
   * Update user notification preferences
   */
  router.patch('/preferences', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const data: UpdateUserPreferencesData = {};

      if (typeof req.body.email_on_event_confirmed === 'boolean') {
        data.email_on_event_confirmed = req.body.email_on_event_confirmed;
      }
      if (typeof req.body.email_on_new_rsvp === 'boolean') {
        data.email_on_new_rsvp = req.body.email_on_new_rsvp;
      }
      if (typeof req.body.email_on_options_ready === 'boolean') {
        data.email_on_options_ready = req.body.email_on_options_ready;
      }

      const prefs = await updateUserPreferences(pool, userId, data);
      if (!prefs) {
        res.status(404).json({ error: 'not_found', message: 'User preferences not found' });
        return;
      }

      res.json({
        email_on_event_confirmed: prefs.email_on_event_confirmed,
        email_on_new_rsvp: prefs.email_on_new_rsvp,
        email_on_options_ready: prefs.email_on_options_ready,
      });
    } catch (error) {
      console.error('Error updating user preferences:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to update preferences' });
    }
  });

  return router;
}
