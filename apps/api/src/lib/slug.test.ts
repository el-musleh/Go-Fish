import { describe, expect, it } from "vitest";

import { toSlug } from "./slug";

describe("toSlug", () => {
  it("normalizes the title and appends a six-character suffix", () => {
    const slug = toSlug("Friday Night Football & Food!");

    expect(slug).toMatch(/^friday-night-football-food-[abcdefghjkmnpqrstuvwxyz23456789]{6}$/);
  });

  it("truncates the normalized title portion before adding the suffix", () => {
    const slug = toSlug("This title is intentionally much longer than thirty six characters");
    const [prefix, suffix] = slug.split(/-([abcdefghjkmnpqrstuvwxyz23456789]{6})$/).filter(Boolean);

    expect(prefix).toHaveLength(36);
    expect(suffix).toHaveLength(6);
  });
});
