import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";

import { env } from "./env";

type InviteeInput = {
  answers: Array<{ questionId: string; selections: string[] }>;
  availableDates: string[];
  email: string;
  responseStatus: "pending" | "responded";
};

export type GenerationInput = {
  title: string;
  description: string | null;
  locationHint: string;
  dateFrom: string;
  dateTo: string;
  overlapScore: number;
  missingResponses: number;
  inviterName: string;
  inviterPreferences: Array<{ questionId: string; selections: string[] }>;
  invitees: InviteeInput[];
  topSharedDates: string[];
};

const structuredOptionSchema = z.object({
  options: z
    .array(
      z.object({
        title: z.string().min(3),
        description: z.string().min(10),
        recommendedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        timeOfDay: z.enum(["morning", "afternoon", "evening", "late_night"]),
        activityType: z.string().min(2),
        locationHint: z.string().min(2),
        whyItFits: z.string().min(12),
        attendanceConfidence: z.number().min(0).max(1),
      }),
    )
    .length(3),
});

export type GeneratedOptions = z.infer<typeof structuredOptionSchema>;

function buildPrompt(input: GenerationInput) {
  return [
    "You are the Go Fish decision agent.",
    "Return exactly 3 activity options that fit the group best.",
    "Prefer shared availability, low-friction coordination, and taste overlap.",
    "If overlap is weak, still return 3 compromise options and explain the compromise.",
    "Stay realistic for the provided location and date range.",
    "",
    "For each option, include:",
    "- title: A short, catchy name for the activity",
    "- description: A 2-3 sentence description of the activity — what it is, what the group will do, and what makes it fun",
    "- recommendedDate: Best date in YYYY-MM-DD format",
    "- timeOfDay: morning, afternoon, evening, or late_night",
    "- activityType: Category of the activity",
    "- locationHint: Where it takes place",
    "- whyItFits: Why this option works well for this specific group based on their preferences",
    "- attendanceConfidence: 0-1 score of how likely everyone can attend",
    "",
    "Consider ALL participants' preferences — both the inviter's and the invitees'.",
    "",
    "Event context:",
    JSON.stringify(input, null, 2),
  ].join("\n");
}

export async function generateOptions(input: GenerationInput) {
  if (!env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is missing.");
  }

  const model = new ChatGoogleGenerativeAI({
    apiKey: env.GOOGLE_API_KEY,
    model: env.GEMINI_MODEL,
    temperature: 0.35,
    maxOutputTokens: 2400,
  });

  const structuredModel = model.withStructuredOutput(structuredOptionSchema, {
    name: "GoFishTopThreeOptions",
  });

  try {
    const parsed = await structuredModel.invoke(buildPrompt(input));
    return {
      parsed,
      source: "gemini" as const,
    };
  } catch (firstError) {
    const parsed = await structuredModel.invoke(buildPrompt(input));
    return {
      parsed,
      source: "gemini" as const,
      retryRecoveredFrom: firstError instanceof Error ? firstError.message : "unknown",
    };
  }
}
