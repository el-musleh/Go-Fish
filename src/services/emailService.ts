import nodemailer, { Transporter } from 'nodemailer';
import { Pool } from 'pg';
import { getEventById } from '../repositories/eventRepository';
import { getActivityOptionsByEventId } from '../repositories/activityOptionRepository';
import { getResponsesByEventId } from '../repositories/responseRepository';
import { getUserById } from '../repositories/userRepository';
import { createEmailLog, updateEmailLogStatus } from '../repositories/emailLogRepository';
import { ActivityOption } from '../models/ActivityOption';

const RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;

export function createTransporter(): Transporter {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT) || 587,
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  });
}

export function buildEmailBody(activity: ActivityOption): string {
  return [
    `Your group activity has been finalized!`,
    ``,
    `Activity: ${activity.title}`,
    `Description: ${activity.description}`,
    `Date: ${activity.suggested_date}`,
    ``,
    `See you there!`,
  ].join('\n');
}

export async function sendNotificationEmails(
  pool: Pool,
  eventId: string,
  transporter?: Transporter
): Promise<void> {
  const event = await getEventById(pool, eventId);
  if (!event || event.status !== 'finalized') return;

  const options = await getActivityOptionsByEventId(pool, eventId);
  const selected = options.find((o) => o.is_selected);
  if (!selected) return;

  const responses = await getResponsesByEventId(pool, eventId);
  const recipientIds = new Set<string>();

  // Add all respondents
  for (const r of responses) {
    recipientIds.add(r.invitee_id);
  }
  // Add the inviter
  recipientIds.add(event.inviter_id);

  const mailer = transporter ?? createTransporter();
  const body = buildEmailBody(selected);
  const subject = `Go Fish: ${selected.title}`;

  for (const userId of recipientIds) {
    const user = await getUserById(pool, userId);
    if (!user) continue;

    const log = await createEmailLog(pool, { event_id: eventId, user_id: userId });

    await sendWithRetry(pool, mailer, log.id, user.email, subject, body);
  }
}

export async function sendWithRetry(
  pool: Pool,
  transporter: Transporter,
  emailLogId: string,
  to: string,
  subject: string,
  body: string,
  attempt: number = 1
): Promise<void> {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER || 'noreply@gofish.app',
      to,
      subject,
      text: body,
    });
    await updateEmailLogStatus(pool, emailLogId, 'sent');
  } catch {
    if (attempt < MAX_RETRIES) {
      await updateEmailLogStatus(pool, emailLogId, 'pending');
      await delay(RETRY_INTERVAL_MS);
      await sendWithRetry(pool, transporter, emailLogId, to, subject, body, attempt + 1);
    } else {
      await updateEmailLogStatus(pool, emailLogId, 'failed');
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
