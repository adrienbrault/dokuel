import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FIRST_DAILY_DATE,
  isPlayableDailyDate,
  listDailyArchive,
} from "./daily-archive.ts";
import { recordDailyResult } from "./daily-results.ts";

describe("isPlayableDailyDate", () => {
  const today = "2026-09-05";

  it("accepts every date from the first daily up to today", () => {
    expect(isPlayableDailyDate(today, today)).toBe(true);
    expect(isPlayableDailyDate(FIRST_DAILY_DATE, today)).toBe(true);
    expect(isPlayableDailyDate("2026-07-14", today)).toBe(true);
  });

  it("refuses dates before the first daily and dates in the future", () => {
    expect(isPlayableDailyDate("2026-04-30", today)).toBe(false);
    expect(isPlayableDailyDate("2026-09-06", today)).toBe(false);
  });

  it("refuses anything that is not a real calendar date", () => {
    for (const junk of ["", "today", "2026-6-1", "2026-02-31", "2026-13-01"]) {
      expect(isPlayableDailyDate(junk, today)).toBe(false);
    }
  });
});

describe("listDailyArchive", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("lists the most recent dates first, grouped by month", () => {
    const months = listDailyArchive({ today: "2026-09-02", limit: 4 });

    expect(months).toEqual([
      {
        month: "2026-09",
        entries: [
          { date: "2026-09-02", result: null },
          { date: "2026-09-01", result: null },
        ],
      },
      {
        month: "2026-08",
        entries: [
          { date: "2026-08-31", result: null },
          { date: "2026-08-30", result: null },
        ],
      },
    ]);
  });

  it("stops at the first daily rather than inventing earlier dates", () => {
    const months = listDailyArchive({ today: "2026-05-02", limit: 10 });

    expect(months.flatMap((m) => m.entries.map((e) => e.date))).toEqual([
      "2026-05-02",
      FIRST_DAILY_DATE,
    ]);
  });

  it("carries the recorded result for a date that was solved", () => {
    recordDailyResult("2026-09-01", 275, 1_800_000_000_000);

    const months = listDailyArchive({ today: "2026-09-02", limit: 2 });

    expect(months[0]?.entries[1]).toEqual({
      date: "2026-09-01",
      result: { time: 275, completedAt: 1_800_000_000_000 },
    });
  });
});
