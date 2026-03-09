import { beforeEach, describe, expect, it } from "bun:test";
import {
  getActivityDates,
  getCompletionRate,
  getImprovementDelta,
  getRecentTimes,
  getStats,
  getStatsForDifficulty,
  saveGameResult,
} from "./stats.ts";

describe("stats", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getStats", () => {
    it("returns empty array when localStorage is empty", () => {
      expect(getStats()).toEqual([]);
    });

    it("returns empty array when localStorage has invalid JSON", () => {
      localStorage.setItem("sudoku_stats", "not valid json");
      expect(getStats()).toEqual([]);
    });

    it("returns stored stats", () => {
      const stats = [
        { difficulty: "easy", time: 120, date: "2026-01-01", won: true },
      ];
      localStorage.setItem("sudoku_stats", JSON.stringify(stats));
      expect(getStats()).toEqual(stats);
    });
  });

  describe("saveGameResult", () => {
    it("persists a game result", () => {
      saveGameResult("easy", 120, true);
      const stats = getStats();
      expect(stats).toHaveLength(1);
      expect(stats[0]!.difficulty).toBe("easy");
      expect(stats[0]!.time).toBe(120);
      expect(stats[0]!.won).toBe(true);
    });

    it("appends to existing stats", () => {
      saveGameResult("easy", 100, true);
      saveGameResult("medium", 200, false);
      expect(getStats()).toHaveLength(2);
    });

    it("trims to last 100 entries", () => {
      for (let i = 0; i < 105; i++) {
        saveGameResult("easy", i, true);
      }
      const stats = getStats();
      expect(stats).toHaveLength(100);
      expect(stats[0]!.time).toBe(5);
    });
  });

  describe("getStatsForDifficulty", () => {
    it("returns null when no games for difficulty", () => {
      expect(getStatsForDifficulty("hard")).toBeNull();
    });

    it("returns null when only losses exist", () => {
      saveGameResult("easy", 120, false);
      expect(getStatsForDifficulty("easy")).toBeNull();
    });

    it("computes best and average time from wins only", () => {
      saveGameResult("easy", 100, true);
      saveGameResult("easy", 200, true);
      saveGameResult("easy", 300, false);
      const result = getStatsForDifficulty("easy");
      expect(result).toEqual({
        gamesPlayed: 2,
        bestTime: 100,
        averageTime: 150,
      });
    });

    it("filters by difficulty", () => {
      saveGameResult("easy", 100, true);
      saveGameResult("medium", 200, true);
      const result = getStatsForDifficulty("easy");
      expect(result?.gamesPlayed).toBe(1);
      expect(result?.bestTime).toBe(100);
    });
  });

  describe("getRecentTimes", () => {
    it("returns empty array when no games exist", () => {
      expect(getRecentTimes("easy")).toEqual([]);
    });

    it("returns only won game times for the difficulty", () => {
      saveGameResult("easy", 100, true);
      saveGameResult("easy", 200, false);
      saveGameResult("easy", 150, true);
      expect(getRecentTimes("easy")).toEqual([100, 150]);
    });

    it("returns last N times when limit specified", () => {
      for (let i = 1; i <= 15; i++) {
        saveGameResult("easy", i * 10, true);
      }
      expect(getRecentTimes("easy", 5)).toEqual([110, 120, 130, 140, 150]);
    });

    it("filters by difficulty", () => {
      saveGameResult("easy", 100, true);
      saveGameResult("medium", 200, true);
      expect(getRecentTimes("medium")).toEqual([200]);
    });
  });

  describe("getImprovementDelta", () => {
    it("returns null when fewer than 2 won games", () => {
      saveGameResult("easy", 100, true);
      expect(getImprovementDelta("easy")).toBeNull();
    });

    it("returns negative delta when last game was faster", () => {
      saveGameResult("easy", 200, true);
      saveGameResult("easy", 180, true);
      expect(getImprovementDelta("easy")).toBe(-20);
    });

    it("returns positive delta when last game was slower", () => {
      saveGameResult("easy", 100, true);
      saveGameResult("easy", 130, true);
      expect(getImprovementDelta("easy")).toBe(30);
    });
  });

  describe("getActivityDates", () => {
    it("returns empty map when no games", () => {
      expect(getActivityDates()).toEqual(new Map());
    });

    it("counts games per date", () => {
      // saveGameResult uses today's date
      saveGameResult("easy", 100, true);
      saveGameResult("medium", 200, true);
      const result = getActivityDates();
      const today = new Date().toISOString().slice(0, 10);
      expect(result.get(today)).toBe(2);
    });
  });

  describe("getCompletionRate", () => {
    it("returns zero rate when no games", () => {
      expect(getCompletionRate("easy")).toEqual({
        won: 0,
        total: 0,
        rate: 0,
      });
    });

    it("computes rate from wins and losses", () => {
      saveGameResult("easy", 100, true);
      saveGameResult("easy", 200, true);
      saveGameResult("easy", 300, false);
      expect(getCompletionRate("easy")).toEqual({
        won: 2,
        total: 3,
        rate: 67,
      });
    });
  });
});
