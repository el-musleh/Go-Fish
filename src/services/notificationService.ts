import { Pool } from 'pg';
import { createNotification, type Notification, type CreateNotificationData } from '../repositories/notificationRepository';

// SSE clients map: userId -> Set of response objects
const sseClients = new Map<string, Set<{ write: (data: string) => void; end: () => void }>>();

/**
 * Register a new SSE client for a user
 */
export function registerSSEClient(userId: string, client: { write: (data: string) => void; end: () => void }): void {
  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId)!.add(client);
}

/**
 * Unregister an SSE client
 */
export function unregisterSSEClient(userId: string, client: { write: (data: string) => void; end: () => void }): void {
  const clients = sseClients.get(userId);
  if (clients) {
    clients.delete(client);
    if (clients.size === 0) {
      sseClients.delete(userId);
    }
  }
}

/**
 * Broadcast a notification to a specific user's SSE clients
 */
export function broadcastNotification(userId: string, notification: Notification): void {
  const clients = sseClients.get(userId);
  if (!clients || clients.size === 0) return;

  const data = `data: ${JSON.stringify(notification)}\n\n`;
  for (const client of clients) {
    try {
      client.write(data);
    } catch (error) {
      console.error(`Failed to send SSE notification to user ${userId}:`, error);
    }
  }
}

/**
 * Create and broadcast a notification
 */
export async function createAndBroadcastNotification(
  pool: Pool,
  data: CreateNotificationData
): Promise<Notification> {
  const notification = await createNotification(pool, data);
  broadcastNotification(data.user_id, notification);
  return notification;
}

// ── Notification Factory Functions ─────────────────────────────────────────────

/**
 * Notify organizer when someone RSVPs to their event
 */
export async function notifyRsvpReceived(
  pool: Pool,
  eventId: string,
  organizerId: string,
  eventTitle: string,
  responderEmail: string
): Promise<Notification | null> {
  try {
    return await createAndBroadcastNotification(pool, {
      user_id: organizerId,
      type: 'rsvp_received',
      title: `New response on "${eventTitle}"`,
      description: `${responderEmail} has submitted their availability`,
      event_id: eventId,
      link: `/events/${eventId}`,
    });
  } catch (error) {
    console.error('Failed to create rsvp_received notification:', error);
    return null;
  }
}

/**
 * Notify participants when an event is finalized
 */
export async function notifyEventFinalized(
  pool: Pool,
  eventId: string,
  participantIds: string[],
  eventTitle: string
): Promise<Notification[]> {
  const notifications: Notification[] = [];
  
  for (const participantId of participantIds) {
    try {
      const notification = await createAndBroadcastNotification(pool, {
        user_id: participantId,
        type: 'event_finalized',
        title: `"${eventTitle}" is confirmed!`,
        description: 'The organizer has selected the final activity',
        event_id: eventId,
        link: `/events/${eventId}/confirmation`,
      });
      notifications.push(notification);
    } catch (error) {
      console.error(`Failed to create event_finalized notification for user ${participantId}:`, error);
    }
  }
  
  return notifications;
}

/**
 * Notify invitee when they visit an invite link
 */
export async function notifyEventInvited(
  pool: Pool,
  eventId: string,
  inviteeId: string,
  eventTitle: string,
  inviteToken: string
): Promise<Notification | null> {
  try {
    return await createAndBroadcastNotification(pool, {
      user_id: inviteeId,
      type: 'event_invited',
      title: `You're invited to "${eventTitle}"`,
      description: 'Tap to view details and submit your availability',
      event_id: eventId,
      link: `/invite/${inviteToken}`,
    });
  } catch (error) {
    console.error('Failed to create event_invited notification:', error);
    return null;
  }
}

/**
 * Notify organizer when activity options are ready
 */
export async function notifyOptionsReady(
  pool: Pool,
  eventId: string,
  organizerId: string,
  eventTitle: string
): Promise<Notification | null> {
  try {
    return await createAndBroadcastNotification(pool, {
      user_id: organizerId,
      type: 'options_ready',
      title: `Activity options ready for "${eventTitle}"`,
      description: 'Review and pick the best option for your group',
      event_id: eventId,
      link: `/events/${eventId}/options`,
    });
  } catch (error) {
    console.error('Failed to create options_ready notification:', error);
    return null;
  }
}
