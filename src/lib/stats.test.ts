import { beforeEach, describe, expect, it } from "vitest";
import { getStats, getStatsForDifficulty, saveGameResult } from "./stats.ts";

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
      expect(stats[0].difficulty).toBe("easy");
      expect(stats[0].time).toBe(120);
      expect(stats[0].won).toBe(true);
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
      expect(stats[0].time).toBe(5);
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
});
