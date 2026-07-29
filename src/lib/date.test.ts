// @vitest-environment node
import { describe, expect, it } from "vitest";
import { todayLocalISO } from "./date.ts";

describe("todayLocalISO", () => {
  it("formats the local calendar date as YYYY-MM-DD", () => {
    // new Date(y, m, d) is constructed in local time, so the expected
    // string holds in every timezone — unlike toISOString(), which
    // reports the UTC date and rolls the daily over mid-afternoon for
    // half the planet.
    expect(todayLocalISO(new Date(2026, 6, 27, 23, 30))).toBe("2026-07-27");
    expect(todayLocalISO(new Date(2026, 6, 27, 0, 10))).toBe("2026-07-27");
  });

  it("zero-pads single-digit months and days", () => {
    expect(todayLocalISO(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(todayLocalISO(new Date(2026, 8, 9))).toBe("2026-09-09");
  });
});
