import {
  availabilitySubmitSchema,
  benchmarkQuestions,
  benchmarkSubmissionSchema,
  eventCreateSchema,
  eventInviteesSchema,
  retryGenerationSchema,
  selectOptionSchema,
} from "@go-fish/contracts";
import { db } from "@go-fish/database";
import type { FastifyInstance, FastifyRequest } from "fastify";

import { auth, headersFromNode } from "../lib/auth";
import { addDays, addHours, formatDateOnly, parseDateOnly } from "../lib/date";
import { AppError } from "../lib/errors";
import { env } from "../lib/env";
import { sendFinalEventEmail } from "../lib/mailer";
import { toSlug } from "../lib/slug";
import { serializeEvent, serializeInvitee, serializeTasteProfile, serializeUser } from "../services/presenters";

async function requireUser(request: FastifyRequest) {
  const session = await auth.api.getSession({
    headers: headersFromNode(request.raw.headers),
  });

  if (!session?.user) {
    throw new AppError("Unauthorized", 401);
  }

  return session.user;
}

function assertDateWindow(dateFrom: string, dateTo: string) {
  if (parseDateOnly(dateFrom) > parseDateOnly(dateTo)) {
    throw new AppError("Start date must be before end date.", 400);
  }
}

async function getEventForOwner(eventId: string, userId: string) {
  const event = await db.event.findFirst({
    where: { id: eventId, inviterId: userId },
    include: {
      invitees: { include: { availableDates: true, user: true } },
      options: true,
    },
  });

  if (!event) {
    throw new AppError("Event not found.", 404);
  }

  return event;
}

async function ensureInviteeLinked(eventId: string, user: { id: string; email: string }) {
  const linkedInvitee = await db.eventInvitee.findFirst({
    where: {
      eventId,
      userId: user.id,
    },
    include: {
      availableDates: true,
    },
  });

  if (linkedInvitee) {
    return linkedInvitee;
  }

  return db.eventInvitee.upsert({
    where: {
      eventId_email: {
        eventId,
        email: user.email.toLowerCase(),
      },
    },
    update: {
      userId: user.id,
    },
    create: {
      eventId,
      email: user.email.toLowerCase(),
      userId: user.id,
    },
    include: {
      availableDates: true,
    },
  });
}

export async function registerEventRoutes(app: FastifyInstance) {
  app.get("/v1/dashboard", async (request) => {
    const user = await requireUser(request);
    const events = await db.event.findMany({
      where: {
        OR: [
          { inviterId: user.id },
          {
            invitees: {
              some: {
                OR: [{ userId: user.id }, { email: user.email.toLowerCase() }],
              },
            },
          },
        ],
      },
      include: {
        invitees: { include: { availableDates: true, user: true } },
        options: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const tasteProfile = await db.tasteProfile.findUnique({
      where: { userId: user.id },
      include: { answers: true },
    });

    return {
      user: serializeUser(user),
      tasteProfile: serializeTasteProfile(tasteProfile),
      events: events.map((event) => serializeEvent(event, event.inviterId === user.id)),
    };
  });

  app.get("/v1/events", async (request) => {
    const user = await requireUser(request);
    const events = await db.event.findMany({
      where: {
        OR: [
          { inviterId: user.id },
          {
            invitees: {
              some: {
                OR: [{ userId: user.id }, { email: user.email.toLowerCase() }],
              },
            },
          },
        ],
      },
      include: {
        invitees: { include: { availableDates: true, user: true } },
        options: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      events: events.map((event) => serializeEvent(event, event.inviterId === user.id)),
    };
  });

  app.post("/v1/events", async (request) => {
    const user = await requireUser(request);
    const payload = eventCreateSchema.parse(request.body);

    const now = new Date();
    const dateFrom = payload.dateFrom ? parseDateOnly(payload.dateFrom) : now;
    const dateTo = payload.dateTo ? parseDateOnly(payload.dateTo) : addDays(now, 14);

    if (dateFrom > dateTo) {
      throw new AppError("Start date must be before end date.", 400);
    }

    const event = await db.event.create({
      data: {
        title: payload.title,
        description: payload.description ?? null,
        locationHint: payload.locationHint ?? "",
        dateFrom,
        dateTo,
        responseDeadlineAt: addHours(now, 24),
        status: "collecting_responses",
        inviterId: user.id,
        slug: toSlug(payload.title),
      },
      include: {
        invitees: { include: { availableDates: true, user: true } },
        options: true,
      },
    });

    return {
      event: serializeEvent(event, true),
    };
  });

  app.post("/v1/events/:id/invitees", async (request) => {
    const user = await requireUser(request);
    const payload = eventInviteesSchema.parse(request.body);
    const event = await getEventForOwner((request.params as { id: string }).id, user.id);

    await db.eventInvitee.deleteMany({
      where: { eventId: event.id },
    });

    await db.eventInvitee.createMany({
      data: payload.emails.map((email) => ({
        eventId: event.id,
        email: email.toLowerCase(),
      })),
    });

    const updated = await db.event.update({
      where: { id: event.id },
      data: {
        status: "collecting_responses",
        responseDeadlineAt: addHours(new Date(), 24),
      },
      include: {
        invitees: { include: { availableDates: true, user: true } },
        options: true,
      },
    });

    return {
      event: serializeEvent(updated, true),
    };
  });

  app.get("/v1/events/:id", async (request) => {
    const user = await requireUser(request);
    const event = await db.event.findFirst({
      where: {
        id: (request.params as { id: string }).id,
        OR: [
          { inviterId: user.id },
          {
            invitees: {
              some: {
                OR: [{ userId: user.id }, { email: user.email.toLowerCase() }],
              },
            },
          },
        ],
      },
      include: {
        inviter: true,
        invitees: { include: { availableDates: true, user: true } },
        options: true,
      },
    });

    if (!event) {
      throw new AppError("Event not found.", 404);
    }

    return {
      event: serializeEvent(event, event.inviterId === user.id),
      invitees: event.invitees.map(serializeInvitee),
      inviter: serializeUser(event.inviter),
    };
  });

  app.get("/v1/events/slug/:slug", async (request) => {
    const user = await requireUser(request);
    const initialEvent = await db.event.findUnique({
      where: { slug: (request.params as { slug: string }).slug },
      include: {
        inviter: true,
        invitees: { include: { availableDates: true, user: true } },
        options: true,
      },
    });

    if (!initialEvent) {
      throw new AppError("Event not found.", 404);
    }

    const isOwner = initialEvent.inviterId === user.id;
    const invitee = isOwner ? null : await ensureInviteeLinked(initialEvent.id, user);
    const event =
      invitee && !initialEvent.invitees.some((item) => item.id === invitee.id)
        ? await db.event.findUniqueOrThrow({
            where: { id: initialEvent.id },
            include: {
              inviter: true,
              invitees: { include: { availableDates: true, user: true } },
              options: true,
            },
          })
        : initialEvent;

    const tasteProfile = await db.tasteProfile.findUnique({
      where: { userId: user.id },
      include: { answers: true },
    });

    return {
      event: {
        ...serializeEvent(event, isOwner),
        inviterName: serializeUser(event.inviter).name,
        invitees: event.invitees.map(serializeInvitee),
      },
      invitee: invitee ? serializeInvitee(invitee) : null,
      viewerHasCompletedBenchmark: Boolean(tasteProfile?.isComplete),
      benchmarkQuestions,
      currentTasteProfile: serializeTasteProfile(tasteProfile),
    };
  });

  app.post("/v1/events/:id/benchmark", async (request) => {
    const user = await requireUser(request);
    const eventId = (request.params as { id: string }).id;
    const payload = benchmarkSubmissionSchema.parse(request.body);

    const event = await db.event.findUnique({
      where: { id: eventId },
      select: { id: true, inviterId: true, invitees: { select: { userId: true, email: true } } },
    });

    if (!event) {
      throw new AppError("Event not found.", 404);
    }

    const isLinked = event.inviterId === user.id || event.invitees.some((invitee) => invitee.userId === user.id || invitee.email === user.email.toLowerCase());
    if (!isLinked) {
      throw new AppError("Forbidden", 403);
    }

    const tasteProfile = await db.tasteProfile.upsert({
      where: { userId: user.id },
      update: { isComplete: true },
      create: { userId: user.id, isComplete: true },
    });

    await db.$transaction([
      db.tasteProfileAnswer.deleteMany({ where: { profileId: tasteProfile.id } }),
      db.tasteProfileAnswer.createMany({
        data: payload.answers.map((answer) => ({
          profileId: tasteProfile.id,
          questionId: answer.questionId,
          selections: answer.selections,
        })),
      }),
    ]);

    const refreshed = await db.tasteProfile.findUniqueOrThrow({
      where: { userId: user.id },
      include: { answers: true },
    });

    return {
      benchmarkQuestions,
      tasteProfile: serializeTasteProfile(refreshed),
    };
  });

  app.post("/v1/events/:id/availability", async (request) => {
    const user = await requireUser(request);
    const eventId = (request.params as { id: string }).id;
    const payload = availabilitySubmitSchema.parse(request.body);

    const event = await db.event.findUnique({
      where: { id: eventId },
      include: {
        invitees: { include: { availableDates: true, user: true } },
        options: true,
      },
    });

    if (!event) {
      throw new AppError("Event not found.", 404);
    }

    if (event.inviterId === user.id) {
      throw new AppError("Organizers cannot answer through the invite link.", 400);
    }

    if (event.status !== "collecting_responses") {
      throw new AppError("This event is no longer collecting responses.", 400);
    }

    const invitee = await ensureInviteeLinked(event.id, user);

    await db.$transaction([
      db.availabilityDate.deleteMany({
        where: { inviteeId: invitee.id },
      }),
      db.availabilityDate.createMany({
        data: payload.dates.map((date) => ({
          inviteeId: invitee.id,
          date: parseDateOnly(date),
        })),
      }),
      db.eventInvitee.update({
        where: { id: invitee.id },
        data: {
          responseStatus: "responded",
          respondedAt: new Date(),
        },
      }),
    ]);

    const updated = await db.event.findUniqueOrThrow({
      where: { id: event.id },
      include: {
        inviter: true,
        invitees: { include: { availableDates: true, user: true } },
        options: true,
      },
    });

    const currentInvitee = updated.invitees.find((item) => item.id === invitee.id) ?? null;
    const tasteProfile = await db.tasteProfile.findUnique({
      where: { userId: user.id },
      include: { answers: true },
    });

    return {
      event: {
        ...serializeEvent(updated, updated.inviterId === user.id),
        inviterName: serializeUser(updated.inviter).name,
        invitees: updated.invitees.map(serializeInvitee),
      },
      invitee: currentInvitee ? serializeInvitee(currentInvitee) : null,
      viewerHasCompletedBenchmark: Boolean(tasteProfile?.isComplete),
      benchmarkQuestions,
      currentTasteProfile: serializeTasteProfile(tasteProfile),
    };
  });

  app.delete("/v1/events/:id", async (request) => {
    const user = await requireUser(request);
    const event = await getEventForOwner((request.params as { id: string }).id, user.id);

    await db.event.update({
      where: { id: event.id },
      data: { selectedOptionId: null },
    });

    await db.event.delete({
      where: { id: event.id },
    });

    return { deleted: true };
  });

  app.post("/v1/events/:id/generate-options", async (request) => {
    const user = await requireUser(request);
    const event = await getEventForOwner((request.params as { id: string }).id, user.id);
    retryGenerationSchema.parse(request.body ?? {});

    await db.event.update({
      where: { id: event.id },
      data: {
        status: "collecting_responses",
      },
    });

    return {
      eventId: event.id,
      requeued: true,
    };
  });

  app.post("/v1/events/:id/select-option", async (request) => {
    const user = await requireUser(request);
    const payload = selectOptionSchema.parse(request.body);
    const event = await getEventForOwner((request.params as { id: string }).id, user.id);

    if (!["awaiting_selection", "finalized"].includes(event.status)) {
      throw new AppError("This event cannot be finalized yet.", 400);
    }

    const selectedOption = event.options.find((option) => option.id === payload.optionId);
    if (!selectedOption) {
      throw new AppError("Option not found.", 404);
    }

    const finalized = await db.event.update({
      where: { id: event.id },
      data: {
        status: "finalized",
        selectedOptionId: selectedOption.id,
      },
      include: {
        inviter: true,
        invitees: { include: { availableDates: true, user: true } },
        options: true,
      },
    });

    const recipients: Array<{ email: string; inviteeId?: string }> = [
      { email: finalized.inviter.email },
      ...finalized.invitees.map((invitee) => ({ email: invitee.email, inviteeId: invitee.id })),
    ];

    await Promise.all(
      recipients.map((recipient) =>
        sendFinalEventEmail({
          eventId: finalized.id,
          eventTitle: `${finalized.title} · ${selectedOption.title}`,
          recipientEmail: recipient.email,
          locationHint: selectedOption.locationHint,
          recommendedDate: formatDateOnly(selectedOption.recommendedDate),
          timeOfDay: selectedOption.timeOfDay,
          whyItFits: selectedOption.whyItFits,
          ...(recipient.inviteeId ? { inviteeId: recipient.inviteeId } : {}),
        }),
      ),
    );

    return {
      event: serializeEvent(finalized, true),
    };
  });
}
