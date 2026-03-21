import { db } from "@go-fish/database";
import nodemailer from "nodemailer";
import { Resend } from "resend";

import { env } from "./env";

type MailInput = {
  html: string;
  recipientEmail: string;
  subject: string;
  text: string;
  type: "magic_link" | "final_details";
  eventId?: string;
  inviteeId?: string;
};

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

const smtpTransport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? "" } : undefined,
});

async function createEmailLog(input: MailInput, provider: string, status: "pending" | "sent" | "failed", metadata?: object) {
  const data = {
    recipientEmail: input.recipientEmail,
    type: input.type,
    provider,
    subject: input.subject,
    status,
    sentAt: status === "sent" ? new Date() : null,
    ...(input.eventId ? { eventId: input.eventId } : {}),
    ...(input.inviteeId ? { inviteeId: input.inviteeId } : {}),
    ...(metadata ? { metadata } : {}),
  };

  return db.emailLog.create({
    data,
  });
}

export async function sendMail(input: MailInput) {
  if (input.type === "final_details" && input.eventId) {
    const existing = await db.emailLog.findFirst({
      where: {
        eventId: input.eventId,
        recipientEmail: input.recipientEmail,
        type: input.type,
        status: "sent",
      },
    });

    if (existing) {
      return { provider: existing.provider, skipped: true as const };
    }
  }

  if (resend) {
    const result = await resend.emails.send({
      from: env.RESEND_FROM,
      to: input.recipientEmail,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    await createEmailLog(input, "resend", "sent", { id: result.data?.id ?? null });
    return { provider: "resend", skipped: false as const };
  }

  const info = await smtpTransport.sendMail({
    from: env.RESEND_FROM,
    to: input.recipientEmail,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  await createEmailLog(input, "smtp", "sent", { messageId: info.messageId });
  return { provider: "smtp", skipped: false as const };
}

export async function sendFinalEventEmail(input: {
  eventId: string;
  eventTitle: string;
  locationHint: string;
  recipientEmail: string;
  recommendedDate: string;
  timeOfDay: string;
  whyItFits: string;
  inviteeId?: string;
}) {
  const payload = {
    eventId: input.eventId,
    recipientEmail: input.recipientEmail,
    subject: `Go Fish picked: ${input.eventTitle}`,
    text: `${input.eventTitle}\nDate: ${input.recommendedDate}\nTime: ${input.timeOfDay}\nWhere: ${input.locationHint}\n\nWhy it fits:\n${input.whyItFits}`,
    html: `<h1>${input.eventTitle}</h1><p><strong>Date:</strong> ${input.recommendedDate}</p><p><strong>Time:</strong> ${input.timeOfDay}</p><p><strong>Where:</strong> ${input.locationHint}</p><p>${input.whyItFits}</p>`,
    type: "final_details" as const,
    ...(input.inviteeId ? { inviteeId: input.inviteeId } : {}),
  };

  return sendMail(payload);
}
