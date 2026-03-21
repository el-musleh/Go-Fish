import type { Event, EventInvitee, EventOption } from "@go-fish/database";
import { describe, expect, it } from "vitest";

import { serializeEvent, serializeUser } from "./presenters";

describe("serializeEvent", () => {
  it("sorts options, formats dates, and computes invitee response counts", () => {
    const event: Event & {
      invitees: Array<
        EventInvitee & {
          availableDates: Array<{ date: Date }>;
        }
      >;
      options: EventOption[];
    } = {
      id: "event_1",
      slug: "sunset-paddle-abc123",
      title: "Sunset Paddle",
      description: "Easy evening plan",
      locationHint: "Neckar riverside",
      dateFrom: new Date("2026-03-24T00:00:00.000Z"),
      dateTo: new Date("2026-03-27T00:00:00.000Z"),
      responseDeadlineAt: new Date("2026-03-22T18:00:00.000Z"),
      status: "awaiting_selection",
      inviterId: "user_1",
      generationAttempts: 1,
      lastGenerationAt: new Date("2026-03-21T12:00:00.000Z"),
      lastGenerationSource: "all_responses",
      selectedOptionId: null,
      createdAt: new Date("2026-03-21T10:00:00.000Z"),
      updatedAt: new Date("2026-03-21T12:05:00.000Z"),
      invitees: [
        {
          id: "invitee_1",
          eventId: "event_1",
          email: "one@example.com",
          userId: "user_2",
          responseStatus: "responded",
          respondedAt: new Date("2026-03-21T11:00:00.000Z"),
          createdAt: new Date("2026-03-21T10:00:00.000Z"),
          updatedAt: new Date("2026-03-21T11:00:00.000Z"),
          availableDates: [{ date: new Date("2026-03-25T00:00:00.000Z") }],
        },
        {
          id: "invitee_2",
          eventId: "event_1",
          email: "two@example.com",
          userId: null,
          responseStatus: "pending",
          respondedAt: null,
          createdAt: new Date("2026-03-21T10:00:00.000Z"),
          updatedAt: new Date("2026-03-21T10:00:00.000Z"),
          availableDates: [],
        },
      ],
      options: [
        {
          id: "option_2",
          eventId: "event_1",
          rank: 2,
          title: "Rooftop drinks",
          description: "Enjoy sunset drinks on a rooftop bar overlooking the city.",
          recommendedDate: new Date("2026-03-26T00:00:00.000Z"),
          timeOfDay: "evening",
          activityType: "social",
          locationHint: "City center",
          whyItFits: "Relaxed option for mixed energy levels.",
          attendanceConfidence: 0.67,
          createdAt: new Date("2026-03-21T12:00:00.000Z"),
          updatedAt: new Date("2026-03-21T12:00:00.000Z"),
        },
        {
          id: "option_1",
          eventId: "event_1",
          rank: 1,
          title: "Kayak on the river",
          description: "Paddle down the Neckar in tandem kayaks with a guided tour.",
          recommendedDate: new Date("2026-03-25T00:00:00.000Z"),
          timeOfDay: "afternoon",
          activityType: "outdoor",
          locationHint: "Neckar riverside",
          whyItFits: "Strong overlap on date and outdoor preferences.",
          attendanceConfidence: 0.83,
          createdAt: new Date("2026-03-21T12:00:00.000Z"),
          updatedAt: new Date("2026-03-21T12:00:00.000Z"),
        },
      ],
    };

    const result = serializeEvent(event, true);

    expect(result.pendingInvitees).toBe(1);
    expect(result.respondedInvitees).toBe(1);
    expect(result.dateFrom).toBe("2026-03-24");
    expect(result.dateTo).toBe("2026-03-27");
    expect(result.options.map((option) => option.id)).toEqual(["option_1", "option_2"]);
    expect(result.options[0]?.recommendedDate).toBe("2026-03-25");
    expect(result.isOwner).toBe(true);
  });
});

describe("serializeUser", () => {
  it("normalizes missing images to null", () => {
    expect(
      serializeUser({
        id: "user_1",
        email: "owner@example.com",
        name: "Owner",
      }),
    ).toEqual({
      id: "user_1",
      email: "owner@example.com",
      name: "Owner",
      image: null,
    });
  });
});
