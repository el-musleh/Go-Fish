import { Pool } from 'pg';
import { getEventById } from '../repositories/eventRepository';
import { getActivityOptionsByEventId } from '../repositories/activityOptionRepository';
import { getResponsesByEventId } from '../repositories/responseRepository';
import { getUserById } from '../repositories/userRepository';
import { createEmailLog, updateEmailLogStatus } from '../repositories/emailLogRepository';
import { ActivityOption } from '../models/ActivityOption';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5_000;
const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_EMAIL_FROM = 'Go Fish <noreply@gofish.ink>';

export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface EmailSendResult {
  provider: 'resend';
  messageId?: string;
  rateLimitRemaining?: string | null;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

function getEmailFrom(): string {
  return (
    process.env.RESEND_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    DEFAULT_EMAIL_FROM
  );
}

export function createResendTransport(apiKey: string): EmailTransport {
  return {
    async send(message: EmailMessage): Promise<EmailSendResult> {
      const payload: Record<string, unknown> = {
        from: message.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      };

      if (message.replyTo) {
        payload.reply_to = message.replyTo;
      }

      console.log(
        `[Email] Resend request -> to=${message.to} subject="${message.subject}" from="${message.from}"`
      );

      const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend API ${response.status}: ${body || response.statusText}`);
      }

      const data = (await response.json().catch(() => null)) as { id?: string } | null;
      return {
        provider: 'resend',
        messageId: data?.id,
        rateLimitRemaining: response.headers.get('x-ratelimit-remaining'),
      };
    },
  };
}

function getEmailTransport(): EmailTransport {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey) {
    return createResendTransport(apiKey);
  }

  throw new Error('No Resend transport configured. Set RESEND_API_KEY.');
}

export function buildEmailBody(activity: ActivityOption): string {
  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
  <h2 style="color:#ff9d49">🐟 Go Fish</h2>
  <p>Your group activity has been finalized!</p>
  <div style="background:#1a100b;border:1px solid rgba(255,157,73,0.2);border-radius:16px;padding:20px;color:#f7efe7">
    <h3 style="margin:0 0 8px">${activity.title}</h3>
    <p style="margin:0 0 8px;color:rgba(247,239,231,0.7)">${activity.description}</p>
    <p style="margin:0;font-size:0.9rem;color:rgba(247,239,231,0.5)">📅 ${activity.suggested_date}${activity.suggested_time ? ` at ${activity.suggested_time}` : ''}</p>
  </div>
  <p style="margin-top:16px">See you there! 🎉</p>
</div>`;
}

export function buildEmailText(activity: ActivityOption): string {
  return [
    'Your group activity has been finalized!',
    '',
    `Activity: ${activity.title}`,
    `Description: ${activity.description}`,
    `Date: ${activity.suggested_date}${activity.suggested_time ? ` at ${activity.suggested_time}` : ''}`,
    '',
    'See you there!',
  ].join('\n');
}

export async function sendNotificationEmails(
  pool: Pool,
  eventId: string,
  transport?: EmailTransport
): Promise<void> {
  const event = await getEventById(pool, eventId);
  if (!event || event.status !== 'finalized') return;

  const options = await getActivityOptionsByEventId(pool, eventId);
  const selected = options.find((option) => option.is_selected);
  if (!selected) return;

  const responses = await getResponsesByEventId(pool, eventId);
  const recipientIds = new Set<string>();

  for (const response of responses) {
    recipientIds.add(response.invitee_id);
  }
  recipientIds.add(event.inviter_id);

  const emailTransport = transport ?? getEmailTransport();
  const html = buildEmailBody(selected);
  const text = buildEmailText(selected);
  const subject = `Go Fish: ${selected.title}`;
  const from = getEmailFrom();

  console.log(
    `[Email] Sending finalized event ${eventId} to ${recipientIds.size} recipients from "${from}"`
  );

  for (const userId of recipientIds) {
    const user = await getUserById(pool, userId);
    if (!user) continue;

    try {
      const log = await createEmailLog(pool, { event_id: eventId, user_id: userId });
      await sendWithRetry(pool, emailTransport, log.id, user.email, from, subject, html, text);
    } catch (error) {
      console.error(`[Email] Recipient pipeline failed for ${user.email}:`, error);
    }
  }
}

export async function sendWithRetry(
  pool: Pool,
  transport: EmailTransport,
  emailLogId: string,
  to: string,
  from: string,
  subject: string,
  html: string,
  text: string,
  attempt: number = 1
): Promise<void> {
  try {
    console.log(`[Email] Attempt ${attempt}/${MAX_RETRIES} -> ${to} (log=${emailLogId})`);
    const result = await transport.send({ from, to, subject, html, text });
    await updateEmailLogStatus(pool, emailLogId, 'sent');
    console.log(
      `[Email] Sent via ${result.provider} to ${to}: "${subject}"` +
      `${result.messageId ? ` messageId=${result.messageId}` : ''}` +
      `${result.rateLimitRemaining ? ` rateLimitRemaining=${result.rateLimitRemaining}` : ''}`
    );
  } catch (error) {
    console.error(`[Email] Failed (attempt ${attempt}/${MAX_RETRIES}) to ${to}:`, error);
    if (attempt < MAX_RETRIES) {
      await updateEmailLogStatus(pool, emailLogId, 'pending');
      await delay(RETRY_DELAY_MS);
      await sendWithRetry(pool, transport, emailLogId, to, from, subject, html, text, attempt + 1);
    } else {
      await updateEmailLogStatus(pool, emailLogId, 'failed');
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
