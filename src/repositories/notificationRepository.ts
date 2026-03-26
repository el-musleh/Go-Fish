import { Pool } from 'pg';

export interface Notification {
  id: string;
  user_id: string;
  type: 'rsvp_received' | 'event_finalized' | 'event_invited' | 'options_ready';
  title: string;
  description: string | null;
  event_id: string | null;
  link: string | null;
  read: boolean;
  expired: boolean;
  created_at: Date;
}

export interface CreateNotificationData {
  user_id: string;
  type: Notification['type'];
  title: string;
  description?: string | null;
  event_id?: string | null;
  link?: string | null;
}

export interface NotificationListResult {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Create a new notification
 */
export async function createNotification(
  pool: Pool,
  data: CreateNotificationData
): Promise<Notification> {
  const result = await pool.query<Notification>(
    `INSERT INTO notification (user_id, type, title, description, event_id, link)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.user_id, data.type, data.title, data.description ?? null, data.event_id ?? null, data.link ?? null]
  );
  return result.rows[0];
}

/**
 * Get notifications for a user with pagination
 */
export async function getNotifications(
  pool: Pool,
  userId: string,
  page: number = 1,
  limit: number = 10
): Promise<NotificationListResult> {
  const offset = (page - 1) * limit;

  const [notificationsResult, countResult] = await Promise.all([
    pool.query<Notification>(
      `SELECT * FROM notification
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM notification WHERE user_id = $1`,
      [userId]
    ),
  ]);

  const total = parseInt(countResult.rows[0].count, 10);
  const hasMore = offset + notificationsResult.rows.length < total;

  return {
    notifications: notificationsResult.rows,
    total,
    page,
    limit,
    hasMore,
  };
}

/**
 * Get recent unread notifications (for bell icon)
 */
export async function getRecentUnreadNotifications(
  pool: Pool,
  userId: string,
  limit: number = 5
): Promise<Notification[]> {
  const result = await pool.query<Notification>(
    `SELECT * FROM notification
     WHERE user_id = $1 AND read = FALSE AND expired = FALSE
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(pool: Pool, userId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM notification
     WHERE user_id = $1 AND read = FALSE AND expired = FALSE`,
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get total notification count
 */
export async function getTotalCount(pool: Pool, userId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM notification WHERE user_id = $1`,
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(
  pool: Pool,
  notificationId: string,
  userId: string
): Promise<boolean> {
  const result = await pool.query(
    `UPDATE notification SET read = TRUE
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [notificationId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(
  pool: Pool,
  userId: string
): Promise<number> {
  const result = await pool.query(
    `UPDATE notification SET read = TRUE
     WHERE user_id = $1 AND read = FALSE`,
    [userId]
  );
  return result.rowCount ?? 0;
}

/**
 * Delete a notification
 */
export async function deleteNotification(
  pool: Pool,
  notificationId: string,
  userId: string
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM notification WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Expire notifications for an event (when event is finalized or deleted)
 */
export async function expireNotificationsForEvent(
  pool: Pool,
  eventId: string
): Promise<number> {
  const result = await pool.query(
    `UPDATE notification SET expired = TRUE
     WHERE event_id = $1 AND expired = FALSE`,
    [eventId]
  );
  return result.rowCount ?? 0;
}

/**
 * Expire notifications by type for an event
 */
export async function expireNotificationsByType(
  pool: Pool,
  eventId: string,
  types: Notification['type'][]
): Promise<number> {
  const result = await pool.query(
    `UPDATE notification SET expired = TRUE
     WHERE event_id = $1 AND type = ANY($2) AND expired = FALSE`,
    [eventId, types]
  );
  return result.rowCount ?? 0;
}

/**
 * Get notification by ID
 */
export async function getNotificationById(
  pool: Pool,
  notificationId: string
): Promise<Notification | null> {
  const result = await pool.query<Notification>(
    `SELECT * FROM notification WHERE id = $1`,
    [notificationId]
  );
  return result.rows[0] ?? null;
}

/**
 * Check if user owns notification
 */
export async function getNotificationWithOwnership(
  pool: Pool,
  notificationId: string,
  userId: string
): Promise<Notification | null> {
  const result = await pool.query<Notification>(
    `SELECT * FROM notification WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );
  return result.rows[0] ?? null;
}
