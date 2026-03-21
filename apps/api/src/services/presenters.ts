import type { Event, EventInvitee, EventOption, TasteProfile, TasteProfileAnswer, User } from "@go-fish/database";
import { benchmarkQuestions } from "@go-fish/contracts";

import { formatDateOnly } from "../lib/date";

type EventWithRelations = Event & {
  invitees: Array<
    EventInvitee & {
      availableDates: Array<{ date: Date }>;
    }
  >;
  options: EventOption[];
};

type TasteProfileWithAnswers = TasteProfile & {
  answers: TasteProfileAnswer[];
};

function displayName(user: Pick<User, "email" | "name">) {
  const trimmedName = user.name.trim();
  if (trimmedName) {
    return trimmedName;
  }

  return user.email.split("@")[0] ?? "Guest";
}

export function serializeTasteProfile(profile: TasteProfileWithAnswers | null) {
  if (!profile) {
    return null;
  }

  return {
    userId: profile.userId,
    isComplete: profile.isComplete,
    answers: profile.answers.map((answer) => ({
      questionId: answer.questionId as (typeof benchmarkQuestions)[number]["id"],
      selections: [...answer.selections],
    })),
  };
}

export function serializeEvent(event: EventWithRelations, isOwner: boolean) {
  const respondedInvitees = event.invitees.filter((invitee) => invitee.responseStatus === "responded").length;
  const pendingInvitees = event.invitees.length - respondedInvitees;

  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    locationHint: event.locationHint,
    dateFrom: formatDateOnly(event.dateFrom),
    dateTo: formatDateOnly(event.dateTo),
    responseDeadlineAt: event.responseDeadlineAt.toISOString(),
    status: event.status,
    isOwner,
    pendingInvitees,
    respondedInvitees,
    selectedOptionId: event.selectedOptionId,
    options: event.options
      .slice()
      .sort((left, right) => left.rank - right.rank)
      .map((option) => ({
        id: option.id,
        rank: option.rank,
        title: option.title,
        recommendedDate: formatDateOnly(option.recommendedDate),
        timeOfDay: option.timeOfDay as "morning" | "afternoon" | "evening" | "late_night",
        activityType: option.activityType,
        locationHint: option.locationHint,
        whyItFits: option.whyItFits,
        attendanceConfidence: option.attendanceConfidence,
      })),
  };
}

export function serializeInvitee(invitee: EventInvitee & { availableDates: Array<{ date: Date }> }) {
  return {
    id: invitee.id,
    email: invitee.email,
    userId: invitee.userId,
    responseStatus: invitee.responseStatus,
    availableDates: invitee.availableDates.map((item) => formatDateOnly(item.date)),
  };
}

export function serializeUser(user: Pick<User, "email" | "id" | "name"> & { image?: string | null | undefined }) {
  return {
    id: user.id,
    email: user.email,
    name: displayName(user),
    image: user.image ?? null,
  };
}
