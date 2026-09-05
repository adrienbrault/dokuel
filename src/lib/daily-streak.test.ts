import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDailyStreak,
  isDailyCompleted,
  recordDailyCompletion,
  recordDailyCompletionWithStatus,
} from "./daily-streak.ts";

describe("daily-streak", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("across DST transitions", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("keeps the streak across spring-forward (23h local day)", () => {
      // US DST starts 2026-03-08 02:00, so midnight Mar 8 → midnight
      // Mar 9 is 23h — an exact 24h-delta comparison rejects it.
      vi.stubEnv("TZ", "America/Los_Angeles");
      recordDailyCompletion("2026-03-08");
      const result = recordDailyCompletion("2026-03-09");
      expect(result.currentStreak).toBe(2);
    });

    it("keeps the streak across fall-back (25h local day)", () => {
      // US DST ends 2026-11-01 02:00, so midnight Nov 1 → midnight
      // Nov 2 is 25h.
      vi.stubEnv("TZ", "America/Los_Angeles");
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
        completedDates: [],
      });
    });

    it("returns stored streak data, migrating pre-completedDates records", () => {
      const data = {
        currentStreak: 3,
        lastCompletedDate: "2026-03-07",
        longestStreak: 5,
      };
      localStorage.setItem("sudoku_daily_streak", JSON.stringify(data));
      expect(getDailyStreak()).toEqual({
        ...data,
        completedDates: ["2026-03-07"],
      });
    });

    it("returns default on invalid JSON", () => {
      localStorage.setItem("sudoku_daily_streak", "not json");
      expect(getDailyStreak()).toEqual({
        currentStreak: 0,
        lastCompletedDate: "",
        longestStreak: 0,
        completedDates: [],
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
          completedDates: [],
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

    it("keeps current and longest streaks beyond the recent-day cap", () => {
      const firstDay = Date.UTC(2026, 0, 1);
      for (let offset = 0; offset < 61; offset++) {
        const date = new Date(firstDay + offset * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
        recordDailyCompletion(date);
      }

      const result = getDailyStreak();
      expect(result.completedDates).toHaveLength(60);
      expect(result.currentStreak).toBe(61);
      expect(result.longestStreak).toBe(61);
    });

    it("persists to localStorage", () => {
      recordDailyCompletion("2026-03-08");
      const stored = JSON.parse(localStorage.getItem("sudoku_daily_streak")!);
      expect(stored.currentStreak).toBe(1);
      expect(stored.lastCompletedDate).toBe("2026-03-08");
    });

    it("keeps the streak when days complete out of order (timezone travel)", () => {
      // Finish Jul 29's daily in Tokyo, fly west where it is still Jul
      // 28, finish that one too. Both days are genuinely done — a
      // single lastCompletedDate scalar saw 29→28 as a broken chain and
      // reset the streak the player just extended.
      recordDailyCompletion("2026-07-29");
      const result = recordDailyCompletion("2026-07-28");
      expect(result.currentStreak).toBe(2);
    });

    it("does not double-count a day recompleted after backwards clock travel", () => {
      recordDailyCompletion("2026-07-29");
      recordDailyCompletion("2026-07-28");
      recordDailyCompletion("2026-07-29");
      const result = recordDailyCompletion("2026-07-28");
      expect(result.currentStreak).toBe(2);
      expect(result.longestStreak).toBe(2);
    });

    it("repairs either half of a streak write on retry", () => {
      for (const failedKey of [
        "sudoku_daily_streak",
        "sudoku_daily_streak_lifetime",
      ]) {
        localStorage.clear();
        const originalSetItem = Storage.prototype.setItem;
        const spy = vi
          .spyOn(Storage.prototype, "setItem")
          .mockImplementation(function (this: Storage, key, value) {
            if (key === failedKey) throw new Error("quota");
            return originalSetItem.call(this, key, value);
          });
        let first: ReturnType<typeof recordDailyCompletionWithStatus>;
        try {
          first = recordDailyCompletionWithStatus("2026-03-08");
        } finally {
          spy.mockRestore();
        }

        expect(first.persisted).toBe(false);
        expect(isDailyCompleted("2026-03-08")).toBe(true);
        expect(localStorage.getItem(failedKey)).toBeNull();

        const retry = recordDailyCompletionWithStatus("2026-03-08");
        expect(retry.persisted).toBe(true);
        expect(isDailyCompleted("2026-03-08")).toBe(true);
        expect(localStorage.getItem("sudoku_daily_streak")).not.toBeNull();
        expect(
          localStorage.getItem("sudoku_daily_streak_lifetime"),
        ).not.toBeNull();
      }
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
