import { beforeEach, describe, expect, it } from "vitest";
import {
  getDailyStreak,
  isDailyCompleted,
  recordDailyCompletion,
} from "./daily-streak.ts";

describe("daily-streak", () => {
  beforeEach(() => {
    localStorage.clear();
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
