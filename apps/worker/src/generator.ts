import { benchmarkQuestions } from "@go-fish/contracts";
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
  invitees: InviteeInput[];
  topSharedDates: string[];
};

const structuredOptionSchema = z.object({
  options: z
    .array(
      z.object({
        title: z.string().min(3),
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

function countSelections(invitees: InviteeInput[]) {
  const scores = new Map<string, number>();

  for (const invitee of invitees) {
    for (const answer of invitee.answers) {
      for (const selection of answer.selections) {
        scores.set(selection, (scores.get(selection) ?? 0) + 1);
      }
    }
  }

  return Array.from(scores.entries()).sort((left, right) => right[1] - left[1]);
}

function topSelections(invitees: InviteeInput[]) {
  return countSelections(invitees)
    .slice(0, 6)
    .map(([value]) => value);
}

function fallbackDatePool(input: GenerationInput) {
  if (input.topSharedDates.length > 0) {
    return input.topSharedDates;
  }

  const allDates = input.invitees.flatMap((invitee) => invitee.availableDates);
  const unique = [...new Set(allDates)];
  if (unique.length > 0) {
    return unique.slice(0, 3);
  }

  return [input.dateFrom];
}

function chooseTimeOfDay(preferences: string[]) {
  if (preferences.includes("Evening")) return "evening";
  if (preferences.includes("Afternoon")) return "afternoon";
  if (preferences.includes("Morning")) return "morning";
  return "late_night";
}

export function heuristicGenerateOptions(input: GenerationInput): GeneratedOptions {
  const selections = topSelections(input.invitees);
  const dates = fallbackDatePool(input);
  const timeOfDay = chooseTimeOfDay(selections);
  const vibes = selections.filter((selection) => benchmarkQuestions.some((question) => question.options.includes(selection as never))).slice(0, 3);
  const activitySeed = selections[0] ?? "Cozy hangout";

  const activityMatrix = [
    {
      title: `${activitySeed} session`,
      activityType: selections.find((selection) => ["Food", "Sport", "Nature", "Culture", "Night out", "Cozy hangout"].includes(selection)) ?? "Cozy hangout",
      why: `High overlap across preferences and availability. Chosen to feel easy to commit to while matching the strongest shared signals: ${vibes.join(", ") || "balanced social time"}.`,
    },
    {
      title: `Flexible ${activitySeed.toLowerCase()} plan`,
      activityType: selections.find((selection) => ["Food", "Sport", "Nature", "Culture", "Night out", "Cozy hangout"].includes(selection)) ?? "Culture",
      why: `Built as a compromise option for the group, especially with ${input.missingResponses} missing response(s) and an overlap score of ${input.overlapScore.toFixed(2)}.`,
    },
    {
      title: `Low-friction ${input.locationHint} meetup`,
      activityType: "Cozy hangout",
      why: `Optimized for simple coordination near ${input.locationHint}, keeping travel and planning effort low while preserving a premium feel.`,
    },
  ];

  return {
    options: activityMatrix.map((activity, index) => ({
      title: activity.title,
      recommendedDate: dates[index % dates.length] ?? input.dateFrom,
      timeOfDay,
      activityType: activity.activityType,
      locationHint: input.locationHint,
      whyItFits: activity.why,
      attendanceConfidence: Math.max(0.35, Math.min(0.95, input.overlapScore - index * 0.12 + 0.45)),
    })),
  };
}

function buildPrompt(input: GenerationInput) {
  return [
    "You are the Go Fish decision agent.",
    "Return exactly 3 options that fit the group best.",
    "Prefer shared availability, low-friction coordination, and taste overlap.",
    "If overlap is weak, still return 3 compromise options and explain the compromise.",
    "Stay realistic for the provided location and date range.",
    "",
    "Event context:",
    JSON.stringify(input, null, 2),
  ].join("\n");
}

export async function generateOptions(input: GenerationInput) {
  if (!env.GOOGLE_API_KEY) {
    if (!env.allowHeuristicFallback) {
      throw new Error("GOOGLE_API_KEY is missing.");
    }

    return {
      parsed: heuristicGenerateOptions(input),
      source: "heuristic" as const,
    };
  }

  const model = new ChatGoogleGenerativeAI({
    apiKey: env.GOOGLE_API_KEY,
    model: env.GEMINI_MODEL,
    temperature: 0.35,
    maxOutputTokens: 1600,
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

