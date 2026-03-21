import { describe, expect, it } from "vitest";

import { benchmarkQuestions, benchmarkSubmissionSchema, eventCreateSchema } from "./index";

describe("contracts", () => {
  it("defines exactly ten benchmark questions", () => {
    expect(benchmarkQuestions).toHaveLength(10);
  });

  it("accepts a complete benchmark submission", () => {
    const payload = {
      answers: benchmarkQuestions.map((question) => ({
        questionId: question.id,
        selections: [question.options[0]],
      })),
    };

    expect(() => benchmarkSubmissionSchema.parse(payload)).not.toThrow();
  });

  it("validates event creation dates", () => {
    expect(() =>
      eventCreateSchema.parse({
        title: "Berlin fish club",
        locationHint: "Berlin Mitte",
        dateFrom: "2026-04-01",
        dateTo: "2026-04-10",
      }),
    ).not.toThrow();
  });
});
