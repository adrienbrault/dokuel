import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getDailyStreak,
  isDailyCompleted,
  recordDailyCompletion,
} from "./daily-streak.ts";

describe("daily-streak", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("across DST transitions", () => {
    const originalTz = process.env.TZ;

    afterEach(() => {
      process.env.TZ = originalTz;
    });

    it("keeps the streak across spring-forward (23h local day)", () => {
      // US DST starts 2026-03-08 02:00, so midnight Mar 8 → midnight
      // Mar 9 is 23h — an exact 24h-delta comparison rejects it.
      process.env.TZ = "America/Los_Angeles";
      recordDailyCompletion("2026-03-08");
      const result = recordDailyCompletion("2026-03-09");
      expect(result.currentStreak).toBe(2);
    });

    it("keeps the streak across fall-back (25h local day)", () => {
      // US DST ends 2026-11-01 02:00, so midnight Nov 1 → midnight
      // Nov 2 is 25h.
      process.env.TZ = "America/Los_Angeles";
      recordDailyCompletion("2026-11-01");
      const result = recordDailyCompletion("2026-11-02");
      expect(result.currentStreak).toBe(2);
    });
  });

  describe("getDailyStreak", () => {
    it("returns default streak when localStorage is empty", () => {
      expect(getDailyStreak()).toEqual({
        currentStreak: 0,
        lastCompletedDate: "",
        longestStreak: 0,
      });
    });

    it("returns stored streak data", () => {
      const data = {
        currentStreak: 3,
        lastCompletedDate: "2026-03-07",
        longestStreak: 5,
      };
      localStorage.setItem("sudoku_daily_streak", JSON.stringify(data));
      expect(getDailyStreak()).toEqual(data);
    });

    it("returns default on invalid JSON", () => {
      localStorage.setItem("sudoku_daily_streak", "not json");
      expect(getDailyStreak()).toEqual({
        currentStreak: 0,
        lastCompletedDate: "",
        longestStreak: 0,
      });
    });

    it("returns default on parseable-but-wrong-shape data", () => {
      // "null" is valid JSON; the old code returned it verbatim and
      // recordDailyCompletion then crashed on streak.lastCompletedDate.
      for (const bad of ["null", "3", '"x"', '{"currentStreak":"3"}']) {
        localStorage.setItem("sudoku_daily_streak", bad);
        expect(getDailyStreak()).toEqual({
          currentStreak: 0,
          lastCompletedDate: "",
          longestStreak: 0,
        });
      }
    });
  });

  describe("recordDailyCompletion", () => {
    it("starts a new streak on first completion", () => {
      const result = recordDailyCompletion("2026-03-08");
      expect(result.currentStreak).toBe(1);
      expect(result.lastCompletedDate).toBe("2026-03-08");
      expect(result.longestStreak).toBe(1);
    });

    it("increments streak on consecutive day", () => {
      recordDailyCompletion("2026-03-07");
      const result = recordDailyCompletion("2026-03-08");
      expect(result.currentStreak).toBe(2);
      expect(result.lastCompletedDate).toBe("2026-03-08");
      expect(result.longestStreak).toBe(2);
    });

    it("is a no-op on same day", () => {
      recordDailyCompletion("2026-03-08");
      const result = recordDailyCompletion("2026-03-08");
      expect(result.currentStreak).toBe(1);
    });

    it("resets streak on gap", () => {
      recordDailyCompletion("2026-03-05");
      const result = recordDailyCompletion("2026-03-08");
      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(1);
    });

    it("preserves longest streak across resets", () => {
      recordDailyCompletion("2026-03-01");
      recordDailyCompletion("2026-03-02");
      recordDailyCompletion("2026-03-03");
      // Gap — streak resets but longest stays 3
      recordDailyCompletion("2026-03-06");
      const result = recordDailyCompletion("2026-03-07");
      expect(result.currentStreak).toBe(2);
      expect(result.longestStreak).toBe(3);
    });

    it("persists to localStorage", () => {
      recordDailyCompletion("2026-03-08");
      const stored = JSON.parse(localStorage.getItem("sudoku_daily_streak")!);
      expect(stored.currentStreak).toBe(1);
      expect(stored.lastCompletedDate).toBe("2026-03-08");
    });
  });

  describe("isDailyCompleted", () => {
    it("returns false when no completions", () => {
      expect(isDailyCompleted("2026-03-08")).toBe(false);
    });

    it("returns true when date matches lastCompletedDate", () => {
      recordDailyCompletion("2026-03-08");
      expect(isDailyCompleted("2026-03-08")).toBe(true);
    });

    it("returns false for a different date", () => {
      recordDailyCompletion("2026-03-07");
      expect(isDailyCompleted("2026-03-08")).toBe(false);
    });
  });
});
