import { beforeEach, describe, expect, it } from "vitest";
import {
  getDailyStreak,
  isDailyCompleted,
  recordDailyCompletion,
} from "./daily-streak.ts";
import {
  exportDailyStreak,
  importDailyStreak,
  validateDailyStreakBackup,
} from "./daily-streak-backup.ts";

describe("daily-streak backup", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("exports the unbounded range and restores continuity beyond recent dates", () => {
    const firstDay = Date.UTC(2026, 0, 1);
    for (let offset = 0; offset < 61; offset++) {
      recordDailyCompletion(
        new Date(firstDay + offset * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
      );
    }

    const backup = exportDailyStreak();
    expect(backup.version).toBe(1);
    expect(backup.lifetime.completedRanges).toEqual([
      { start: "2026-01-01", end: "2026-03-02" },
    ]);

    localStorage.clear();
    expect(importDailyStreak(backup)).toBe(true);
    expect(getDailyStreak().currentStreak).toBe(61);
    expect(getDailyStreak().longestStreak).toBe(61);
    expect(isDailyCompleted("2026-01-01")).toBe(true);
  });

  it("rejects unknown or malformed versions without changing the current streak", () => {
    recordDailyCompletion("2026-03-08");
    const before = exportDailyStreak();

    expect(validateDailyStreakBackup({ ...before, version: 2 })).toBeNull();
    expect(importDailyStreak({ ...before, version: 2 })).toBe(false);
    expect(importDailyStreak({ version: 1 })).toBe(false);
    expect(exportDailyStreak()).toEqual(before);
  });

  it("preserves the current streak when a lifetime write fails", () => {
    recordDailyCompletion("2026-03-08");
    const before = exportDailyStreak();
    const replacement = {
      ...before,
      streak: { ...before.streak, currentStreak: 99 },
    };
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "sudoku_daily_streak_lifetime") {
        throw new Error("quota");
      }
      return originalSetItem.call(this, key, value);
    };
    try {
      expect(importDailyStreak(replacement)).toBe(false);
    } finally {
      Storage.prototype.setItem = originalSetItem;
    }
    expect(exportDailyStreak()).toEqual(before);
  });
});
