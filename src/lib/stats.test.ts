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
        {
          difficulty: "easy",
          assistLevel: "standard",
          time: 120,
          date: "2026-01-01",
          won: true,
        },
      ];
      localStorage.setItem("sudoku_stats", JSON.stringify(stats));
      expect(getStats()).toEqual(stats);
    });

    it("defaults entries saved before assist-level tracking to standard", () => {
      const legacy = [
        { difficulty: "easy", time: 120, date: "2026-01-01", won: true },
      ];
      localStorage.setItem("sudoku_stats", JSON.stringify(legacy));
      expect(getStats()[0]!.assistLevel).toBe("standard");
    });
  });

  describe("saveGameResult", () => {
    it("persists a game result", () => {
      saveGameResult("easy", "standard", 120, true);
      const stats = getStats();
      expect(stats).toHaveLength(1);
      expect(stats[0]!.difficulty).toBe("easy");
      expect(stats[0]!.time).toBe(120);
      expect(stats[0]!.won).toBe(true);
    });

    it("records the assist level the game was played under", () => {
      saveGameResult("easy", "paper", 120, true);
      expect(getStats()[0]!.assistLevel).toBe("paper");
    });

    it("appends to existing stats", () => {
      saveGameResult("easy", "standard", 100, true);
      saveGameResult("medium", "full", 200, false);
      expect(getStats()).toHaveLength(2);
    });

    it("trims to last 100 entries", () => {
      for (let i = 0; i < 105; i++) {
        saveGameResult("easy", "standard", i, true);
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
      saveGameResult("easy", "standard", 120, false);
      expect(getStatsForDifficulty("easy")).toBeNull();
    });

    it("computes best and average time from wins only", () => {
      saveGameResult("easy", "standard", 100, true);
      saveGameResult("easy", "standard", 200, true);
      saveGameResult("easy", "standard", 300, false);
      const result = getStatsForDifficulty("easy");
      expect(result).toEqual({
        gamesPlayed: 2,
        bestTime: 100,
        averageTime: 150,
      });
    });

    it("filters by difficulty", () => {
      saveGameResult("easy", "standard", 100, true);
      saveGameResult("medium", "standard", 200, true);
      const result = getStatsForDifficulty("easy");
      expect(result?.gamesPlayed).toBe(1);
      expect(result?.bestTime).toBe(100);
    });
  });
});
