import nodemailer from 'nodemailer';
import { Pool } from 'pg';
import { getEventById } from '../repositories/eventRepository';
import { getActivityOptionsByEventId } from '../repositories/activityOptionRepository';
import { getResponsesByEventId } from '../repositories/responseRepository';
import { getUserById } from '../repositories/userRepository';
import { createEmailLog, updateEmailLogStatus } from '../repositories/emailLogRepository';
import { ActivityOption } from '../models/ActivityOption';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5_000;
const DEFAULT_BREVO_SMTP_HOST = 'smtp-relay.brevo.com';
const DEFAULT_BREVO_SMTP_PORT = 587;
const DEFAULT_EMAIL_FROM = 'Go Fish <no-reply@example.com>';

export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<void>;
}

let smtpTransport: nodemailer.Transporter | null = null;

function parseMailbox(value: string): { email: string; name?: string } {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.*)<([^>]+)>$/);

  if (!match) {
    return { email: trimmed };
  }

  const name = match[1].trim().replace(/^"|"$/g, '');
  return {
    email: match[2].trim(),
    ...(name ? { name } : {}),
  };
}

function getEmailFrom(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.BREVO_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    DEFAULT_EMAIL_FROM
  );
}

function getBrevoSmtpTransporter(): nodemailer.Transporter {
  if (smtpTransport) {
    return smtpTransport;
  }

  const user = process.env.BREVO_SMTP_USER?.trim();
  const pass = process.env.BREVO_SMTP_PASS?.trim();

  if (!user || !pass) {
    throw new Error('Brevo SMTP fallback is not configured');
  }

  const host = process.env.BREVO_SMTP_HOST?.trim() || DEFAULT_BREVO_SMTP_HOST;
  const port = Number(process.env.BREVO_SMTP_PORT || DEFAULT_BREVO_SMTP_PORT);
  const secure = process.env.BREVO_SMTP_SECURE === 'true' || port === 465;

  smtpTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  return smtpTransport;
}

function createBrevoApiTransport(apiKey: string): EmailTransport {
  return {
    async send(message: EmailMessage): Promise<void> {
      const payload: Record<string, unknown> = {
        sender: parseMailbox(message.from),
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
      };

      if (message.replyTo) {
        payload.replyTo = parseMailbox(message.replyTo);
      }

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Brevo API ${response.status}: ${body || response.statusText}`);
      }
    },
  };
}

function createBrevoSmtpTransport(): EmailTransport {
  return {
    async send(message: EmailMessage): Promise<void> {
      await getBrevoSmtpTransporter().sendMail({
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
      });
    },
  };
}

function getEmailTransport(): EmailTransport {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (apiKey) {
    return createBrevoApiTransport(apiKey);
  }

  const smtpUser = process.env.BREVO_SMTP_USER?.trim();
  const smtpPass = process.env.BREVO_SMTP_PASS?.trim();
  if (smtpUser && smtpPass) {
    return createBrevoSmtpTransport();
  }

  throw new Error(
    'No Brevo transport configured. Set BREVO_API_KEY or BREVO_SMTP_USER/BREVO_SMTP_PASS.'
  );
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
    await transport.send({ from, to, subject, html, text });
    await updateEmailLogStatus(pool, emailLogId, 'sent');
    console.log(`[Email] Sent to ${to}: "${subject}"`);
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
