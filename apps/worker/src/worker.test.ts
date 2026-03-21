import { describe, expect, it, vi } from "vitest";

import { heuristicGenerateOptions } from "./generator";
import { eventReadyForGeneration } from "./logic";

describe("worker", () => {
  it("marks events ready when all invitees responded", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-21T10:00:00.000Z"));

    expect(
      eventReadyForGeneration({
        deadline: new Date("2026-03-22T10:00:00.000Z"),
        pendingInvitees: 0,
        totalInvitees: 2,
      }),
    ).toBe(true);
  });

  it("keeps brand-new groups idle until at least one person joins", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T10:00:00.000Z"));

    expect(
      eventReadyForGeneration({
        deadline: new Date("2026-03-22T10:00:00.000Z"),
        pendingInvitees: 0,
        totalInvitees: 0,
      }),
    ).toBe(false);
  });

  it("creates exactly three heuristic options", () => {
    const result = heuristicGenerateOptions({
      title: "Dinner in Berlin",
      description: "Find a relaxed night",
      locationHint: "Berlin Mitte",
      dateFrom: "2026-04-01",
      dateTo: "2026-04-08",
      overlapScore: 0.75,
      missingResponses: 1,
      inviterName: "Chris",
      topSharedDates: ["2026-04-03", "2026-04-05"],
      invitees: [
        {
          email: "one@example.com",
          responseStatus: "responded",
          availableDates: ["2026-04-03"],
          answers: [{ questionId: "activityTypes", selections: ["Food"] }],
        },
        {
          email: "two@example.com",
          responseStatus: "responded",
          availableDates: ["2026-04-03", "2026-04-05"],
          answers: [{ questionId: "preferredTime", selections: ["Evening"] }],
        },
      ],
    });

    expect(result.options).toHaveLength(3);
    expect(result.options[0]?.recommendedDate).toBe("2026-04-03");
  });
});
