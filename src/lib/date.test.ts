// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DAY_MS, parseDateUTC, todayLocalISO, toISODateUTC } from "./date.ts";

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

describe("parseDateUTC", () => {
  it("reads a real calendar date as UTC midnight", () => {
    expect(parseDateUTC("2026-05-01")).toBe(Date.UTC(2026, 4, 1));
  });

  it("refuses malformed strings and days that never existed", () => {
    // Date.UTC would happily roll 2026-02-31 into March; a date that
    // does not round-trip is not a date.
    for (const junk of ["", "today", "2026-6-1", "2026-02-31", "2026-13-01"]) {
      expect(parseDateUTC(junk)).toBeNull();
    }
  });

  it("round-trips through toISODateUTC one day at a time", () => {
    const start = parseDateUTC("2026-12-31") ?? 0;
    expect(toISODateUTC(start + DAY_MS)).toBe("2027-01-01");
  });
});
