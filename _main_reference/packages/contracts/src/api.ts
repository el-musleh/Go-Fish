import { z } from "zod";

import { benchmarkQuestionIds, benchmarkQuestions, benchmarkSubmissionSchema } from "./benchmark";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date string.");

export const eventStatusSchema = z.enum([
  "draft",
  "collecting_responses",
  "generating_options",
  "awaiting_selection",
  "finalized",
  "generation_failed",
]);

export const inviteeResponseStatusSchema = z.enum(["pending", "responded"]);
export const emailTypeSchema = z.enum(["magic_link", "final_details"]);
export const timeOfDaySchema = z.enum(["morning", "afternoon", "evening", "late_night"]);

export const eventCreateSchema = z.object({
  title: z.string().min(2).max(80),
  description: z.string().max(280).optional(),
  locationHint: z.string().max(120).optional(),
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
});

export const eventInviteesSchema = z.object({
  emails: z.array(z.email()).min(1).max(24),
});

export const availabilitySubmitSchema = z.object({
  dates: z.array(isoDate).min(1),
});

export const eventOptionSchema = z.object({
  id: z.string(),
  rank: z.number().int().min(1).max(3),
  title: z.string(),
  recommendedDate: isoDate,
  timeOfDay: timeOfDaySchema,
  activityType: z.string(),
  locationHint: z.string(),
  whyItFits: z.string(),
  attendanceConfidence: z.number().min(0).max(1),
});

export const inviteeSchema = z.object({
  id: z.string(),
  email: z.email(),
  userId: z.string().nullable(),
  name: z.string().nullable(),
  responseStatus: inviteeResponseStatusSchema,
  availableDates: z.array(isoDate),
});

export const tasteProfileAnswerSchema = z.object({
  questionId: z.enum(benchmarkQuestionIds as [typeof benchmarkQuestionIds[number], ...typeof benchmarkQuestionIds[number][]]),
  selections: z.array(z.string()),
});

export const tasteProfileSchema = z.object({
  userId: z.string(),
  isComplete: z.boolean(),
  answers: z.array(tasteProfileAnswerSchema),
});

export const eventSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  locationHint: z.string(),
  dateFrom: isoDate,
  dateTo: isoDate,
  responseDeadlineAt: z.string(),
  status: eventStatusSchema,
  isOwner: z.boolean(),
  pendingInvitees: z.number().int().nonnegative(),
  respondedInvitees: z.number().int().nonnegative(),
  options: z.array(eventOptionSchema),
  selectedOptionId: z.string().nullable(),
});

export const eventListResponseSchema = z.object({
  events: z.array(eventSummarySchema),
});

export const joinEventResponseSchema = z.object({
  event: eventSummarySchema.extend({
    inviterName: z.string(),
    invitees: z.array(inviteeSchema),
  }),
  invitee: inviteeSchema.nullable(),
  viewerHasCompletedBenchmark: z.boolean(),
  benchmarkQuestions: z.custom<typeof benchmarkQuestions>((value) => value === benchmarkQuestions),
  currentTasteProfile: tasteProfileSchema.nullable(),
});

export const selectOptionSchema = z.object({
  optionId: z.string(),
});

export const retryGenerationSchema = z.object({
  reason: z.string().max(120).optional(),
});

export const apiErrorSchema = z.object({
  error: z.string(),
});

export const preferencesResponseSchema = z.object({
  benchmarkQuestions: z.custom<typeof benchmarkQuestions>((value) => value === benchmarkQuestions),
  tasteProfile: tasteProfileSchema.nullable(),
});

export const dashboardResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.email(),
    name: z.string(),
    image: z.string().nullable(),
  }),
  tasteProfile: tasteProfileSchema.nullable(),
  events: z.array(eventSummarySchema),
});

export const generateOptionsResponseSchema = z.object({
  eventId: z.string(),
  options: z.array(eventOptionSchema).length(3),
  source: z.enum(["gemini", "heuristic"]),
});

export const benchmarkMetadataSchema = z.custom<typeof benchmarkQuestions>((value) => value === benchmarkQuestions);

export const schemas = {
  apiErrorSchema,
  availabilitySubmitSchema,
  benchmarkMetadataSchema,
  benchmarkSubmissionSchema,
  dashboardResponseSchema,
  eventCreateSchema,
  eventInviteesSchema,
  eventListResponseSchema,
  eventOptionSchema,
  eventStatusSchema,
  generateOptionsResponseSchema,
  joinEventResponseSchema,
  preferencesResponseSchema,
  retryGenerationSchema,
  selectOptionSchema,
  timeOfDaySchema,
};

export type ApiError = z.infer<typeof apiErrorSchema>;
export type AvailabilitySubmit = z.infer<typeof availabilitySubmitSchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
export type EventCreate = z.infer<typeof eventCreateSchema>;
export type EventInvitees = z.infer<typeof eventInviteesSchema>;
export type EventListResponse = z.infer<typeof eventListResponseSchema>;
export type EventOption = z.infer<typeof eventOptionSchema>;
export type EventStatus = z.infer<typeof eventStatusSchema>;
export type EventSummary = z.infer<typeof eventSummarySchema>;
export type GenerateOptionsResponse = z.infer<typeof generateOptionsResponseSchema>;
export type Invitee = z.infer<typeof inviteeSchema>;
export type JoinEventResponse = z.infer<typeof joinEventResponseSchema>;
export type PreferencesResponse = z.infer<typeof preferencesResponseSchema>;
export type SelectOptionPayload = z.infer<typeof selectOptionSchema>;
export type TasteProfile = z.infer<typeof tasteProfileSchema>;
export type TimeOfDay = z.infer<typeof timeOfDaySchema>;
