import { z } from "zod";

export const benchmarkQuestions = [
  {
    id: "activityTypes",
    label: "What kinds of activities feel right most often?",
    description: "This shapes the first-pass activity mix.",
    options: ["Food", "Sport", "Nature", "Culture", "Night out", "Cozy hangout"],
  },
  {
    id: "groupSize",
    label: "What group size usually feels best?",
    description: "Helps avoid plans that feel too crowded or too quiet.",
    options: ["1:1", "Small group", "Mid-size group", "Big group"],
  },
  {
    id: "environment",
    label: "Where do you prefer spending your time?",
    description: "Guides indoor and outdoor balance.",
    options: ["Mostly indoor", "Mostly outdoor", "A mix of both"],
  },
  {
    id: "budget",
    label: "What budget range usually works for you?",
    description: "Used to avoid unrealistic suggestions.",
    options: ["Free", "Low", "Medium", "Premium"],
  },
  {
    id: "foodConstraints",
    label: "What food constraints should plans respect?",
    description: "Important for meal-based options and meetup spots.",
    options: ["Vegetarian", "Vegan", "Halal", "Kosher", "Gluten-free", "No preference"],
  },
  {
    id: "energyLevel",
    label: "What energy level sounds most like you?",
    description: "Balances high-output and low-friction plans.",
    options: ["Low-key", "Balanced", "High-energy"],
  },
  {
    id: "planningStyle",
    label: "How do you like plans to feel?",
    description: "Controls spontaneous versus structured options.",
    options: ["Spontaneous", "Loose structure", "Fully planned"],
  },
  {
    id: "travelRadius",
    label: "How far are you usually willing to travel?",
    description: "Keeps suggestions within a realistic radius.",
    options: ["Walkable", "Within the city", "Short train ride", "Weekend stretch"],
  },
  {
    id: "preferredTime",
    label: "When do plans usually fit best?",
    description: "Used to rank day-part suggestions.",
    options: ["Morning", "Afternoon", "Evening", "Late night"],
  },
  {
    id: "vibe",
    label: "What vibe do you usually want?",
    description: "Refines the tone of the recommendation.",
    options: ["Social", "Creative", "Relaxed", "Competitive", "Exploratory", "Romantic"],
  },
] as const;

export type BenchmarkQuestion = (typeof benchmarkQuestions)[number];
export type BenchmarkQuestionId = BenchmarkQuestion["id"];

export const benchmarkQuestionIds = benchmarkQuestions.map((question) => question.id);

export const benchmarkAnswerSchema = z.object({
  questionId: z.enum(benchmarkQuestionIds as [BenchmarkQuestionId, ...BenchmarkQuestionId[]]),
  selections: z.array(z.string().min(1)).min(1),
});

export const benchmarkSubmissionSchema = z.object({
  answers: z
    .array(benchmarkAnswerSchema)
    .length(benchmarkQuestions.length)
    .superRefine((answers, ctx) => {
      const ids = new Set(answers.map((answer) => answer.questionId));
      if (ids.size !== benchmarkQuestions.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each benchmark question must be answered exactly once.",
        });
      }
    }),
});

export type BenchmarkSubmission = z.infer<typeof benchmarkSubmissionSchema>;

