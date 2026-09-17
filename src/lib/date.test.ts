// @vitest-environment node
import { describe, expect, it } from "vitest";
import { startOfLocalDay, todayLocalISO } from "./date.ts";

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

// The app tsconfig has no node types, so reach the runner's env
// through a narrow cast rather than a global `process`.
const runnerEnv = (
  globalThis as unknown as {
    process: { env: Record<string, string | undefined> };
  }
).process.env;

/** Node re-reads TZ on the next Date call, so a timezone can be pinned
 *  for the duration of one assertion. */
function withTimeZone(timeZone: string, run: () => void) {
  const previous = runnerEnv.TZ;
  runnerEnv.TZ = timeZone;
  try {
    run();
  } finally {
    runnerEnv.TZ = previous;
  }
}

describe("startOfLocalDay", () => {
  it("never yields NaN for a date it can't read", () => {
    // A corrupt stored date must not poison the sort comparator that
    // orders the game history: NaN there leaves the list in whatever
    // order the entries happened to be in.
    expect(startOfLocalDay("not-a-date")).toBe(0);
    expect(new Date(startOfLocalDay("2026")).getFullYear()).toBe(2026);
  });

  it("resolves a stored date to local midnight, not UTC midnight", () => {
    // Dates are written by todayLocalISO, so west of UTC a UTC-midnight
    // reading lands on the previous local afternoon and reorders the
    // day's games around it.
    withTimeZone("America/Los_Angeles", () => {
      const start = new Date(startOfLocalDay("2026-02-10"));
      expect([
        start.getFullYear(),
        start.getMonth(),
        start.getDate(),
        start.getHours(),
      ]).toEqual([2026, 1, 10, 0]);
    });
  });
});
