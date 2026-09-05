import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getDailyResult,
  getDailyResults,
  recordDailyResult,
} from "./daily-results.ts";

describe("daily results", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("remembers the time a date was solved in", () => {
    recordDailyResult("2026-05-16", 312, 1_800_000_000_000);

    expect(getDailyResult("2026-05-16")).toEqual({
      time: 312,
      completedAt: 1_800_000_000_000,
    });
  });

  it("has nothing to say about a date that was never solved", () => {
    expect(getDailyResult("2026-05-17")).toBeNull();
    expect(getDailyResults()).toEqual({});
  });

  it("keeps the first completion when a date is replayed", () => {
    // The archive shows when a date was solved; a replay months later
    // must not rewrite that history.
    recordDailyResult("2026-05-16", 312, 1_800_000_000_000);
    recordDailyResult("2026-05-16", 120, 1_900_000_000_000);

    expect(getDailyResult("2026-05-16")).toEqual({
      time: 312,
      completedAt: 1_800_000_000_000,
    });
  });

  it("ignores stored junk rather than rendering it", () => {
    localStorage.setItem(
      "sudoku_daily_results",
      JSON.stringify({
        "2026-05-16": { time: 300, completedAt: 1 },
        "not-a-date": { time: 10, completedAt: 1 },
        "2026-05-18": { time: "fast", completedAt: 1 },
        "2026-05-19": null,
      }),
    );

    expect(getDailyResults()).toEqual({
      "2026-05-16": { time: 300, completedAt: 1 },
    });
  });
});
