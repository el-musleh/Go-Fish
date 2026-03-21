import { db } from "@go-fish/database";

import { formatDateOnly } from "./date";
import { env } from "./env";
import { generateOptions, type GenerationInput } from "./generator";
import { eventReadyForGeneration } from "./logic";

function buildDateFrequency(dates: string[]) {
  const counts = new Map<string, number>();
  for (const date of dates) {
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  return counts;
}

async function buildGenerationInput(eventId: string): Promise<GenerationInput> {
  const event = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    include: {
      inviter: true,
      invitees: {
        include: {
          user: {
            include: {
              tasteProfile: {
                include: {
                  answers: true,
                },
              },
            },
          },
          availableDates: true,
        },
      },
    },
  });

  const allDates = event.invitees.flatMap((invitee) => invitee.availableDates.map((item) => formatDateOnly(item.date)));
  const frequency = buildDateFrequency(allDates);
  const topSharedDates = [...frequency.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([date]) => date);

  const overlapScore =
    event.invitees.length === 0
      ? 0
      : (topSharedDates[0] ? (frequency.get(topSharedDates[0]) ?? 0) / event.invitees.length : 0);

  const missingResponses = event.invitees.filter((invitee) => invitee.responseStatus === "pending").length;

  return {
    title: event.title,
    description: event.description,
    locationHint: event.locationHint,
    dateFrom: formatDateOnly(event.dateFrom),
    dateTo: formatDateOnly(event.dateTo),
    overlapScore,
    missingResponses,
    inviterName: event.inviter.name,
    topSharedDates,
    invitees: event.invitees.map((invitee) => ({
      email: invitee.email,
      responseStatus: invitee.responseStatus,
      availableDates: invitee.availableDates.map((item) => formatDateOnly(item.date)),
      answers: invitee.user?.tasteProfile?.answers.map((answer) => ({
        questionId: answer.questionId,
        selections: answer.selections,
      })) ?? [],
    })),
  };
}

async function generateEventOptions(eventId: string) {
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: {
      invitees: true,
    },
  });

  if (!event || event.status !== "collecting_responses") {
    return;
  }

  const pendingInvitees = event.invitees.filter((invitee) => invitee.responseStatus === "pending").length;
  if (!eventReadyForGeneration({ deadline: event.responseDeadlineAt, pendingInvitees, totalInvitees: event.invitees.length })) {
    return;
  }

  const lock = await db.event.updateMany({
    where: {
      id: eventId,
      status: "collecting_responses",
    },
    data: {
      status: "generating_options",
    },
  });

  if (lock.count === 0) {
    return;
  }

  try {
    const input = await buildGenerationInput(eventId);
    const result = await generateOptions(input);

    await db.$transaction([
      db.eventOption.deleteMany({
        where: { eventId },
      }),
      db.eventOption.createMany({
        data: result.parsed.options.map((option, index) => ({
          eventId,
          rank: index + 1,
          title: option.title,
          recommendedDate: new Date(`${option.recommendedDate}T00:00:00.000Z`),
          timeOfDay: option.timeOfDay,
          activityType: option.activityType,
          locationHint: option.locationHint,
          whyItFits: option.whyItFits,
          attendanceConfidence: option.attendanceConfidence,
        })),
      }),
      db.event.update({
        where: { id: eventId },
        data: {
          status: "awaiting_selection",
          generationAttempts: { increment: 1 },
          lastGenerationAt: new Date(),
          lastGenerationSource: result.source,
        },
      }),
    ]);
  } catch (error) {
    console.error(`Failed to generate options for event ${eventId}`, error);
    await db.$transaction([
      db.eventOption.deleteMany({
        where: { eventId },
      }),
      db.event.update({
        where: { id: eventId },
        data: {
          status: "generation_failed",
          generationAttempts: { increment: 1 },
        },
      }),
    ]);
  }
}

async function scanPendingEvents() {
  const events = await db.event.findMany({
    where: {
      status: "collecting_responses",
    },
    select: {
      id: true,
    },
  });

  for (const event of events) {
    await generateEventOptions(event.id);
  }
}

async function main() {
  await scanPendingEvents();
  setInterval(() => {
    void scanPendingEvents();
  }, env.intervalMs);
}

await main();
