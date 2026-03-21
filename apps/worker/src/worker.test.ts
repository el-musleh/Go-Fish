import { describe, expect, it, vi } from "vitest";

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
});
