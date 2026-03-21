import { Resend } from 'resend';
import { Pool } from 'pg';
import { getEventById } from '../repositories/eventRepository';
import { getActivityOptionsByEventId } from '../repositories/activityOptionRepository';
import { getResponsesByEventId } from '../repositories/responseRepository';
import { getUserById } from '../repositories/userRepository';
import { createEmailLog, updateEmailLogStatus } from '../repositories/emailLogRepository';
import { ActivityOption } from '../models/ActivityOption';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5_000;

function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not configured');
  return new Resend(key);
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
    `Your group activity has been finalized!`,
    ``,
    `Activity: ${activity.title}`,
    `Description: ${activity.description}`,
    `Date: ${activity.suggested_date}${activity.suggested_time ? ` at ${activity.suggested_time}` : ''}`,
    ``,
    `See you there!`,
  ].join('\n');
}

export async function sendNotificationEmails(
  pool: Pool,
  eventId: string,
  resendClient?: Resend
): Promise<void> {
  const event = await getEventById(pool, eventId);
  if (!event || event.status !== 'finalized') return;

  const options = await getActivityOptionsByEventId(pool, eventId);
  const selected = options.find((o) => o.is_selected);
  if (!selected) return;

  const responses = await getResponsesByEventId(pool, eventId);
  const recipientIds = new Set<string>();

  for (const r of responses) {
    recipientIds.add(r.invitee_id);
  }
  recipientIds.add(event.inviter_id);

  const client = resendClient ?? getResendClient();
  const html = buildEmailBody(selected);
  const text = buildEmailText(selected);
  const subject = `Go Fish: ${selected.title}`;
  const from = process.env.RESEND_FROM || 'Go Fish <onboarding@resend.dev>';

  for (const userId of recipientIds) {
    const user = await getUserById(pool, userId);
    if (!user) continue;

    const log = await createEmailLog(pool, { event_id: eventId, user_id: userId });
    await sendWithRetry(pool, client, log.id, user.email, from, subject, html, text);
  }
}

export async function sendWithRetry(
  pool: Pool,
  client: Resend,
  emailLogId: string,
  to: string,
  from: string,
  subject: string,
  html: string,
  text: string,
  attempt: number = 1
): Promise<void> {
  try {
    const { error } = await client.emails.send({ from, to, subject, html, text });
    if (error) throw new Error(error.message);
    await updateEmailLogStatus(pool, emailLogId, 'sent');
    console.log(`[Email] Sent to ${to}: "${subject}"`);
  } catch (err) {
    console.error(`[Email] Failed (attempt ${attempt}/${MAX_RETRIES}) to ${to}:`, err);
    if (attempt < MAX_RETRIES) {
      await updateEmailLogStatus(pool, emailLogId, 'pending');
      await delay(RETRY_DELAY_MS);
      await sendWithRetry(pool, client, emailLogId, to, from, subject, html, text, attempt + 1);
    } else {
      await updateEmailLogStatus(pool, emailLogId, 'failed');
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
