import { beforeEach, describe, expect, it, vi } from "vitest";
import * as dateModule from "./date.ts";
import {
  getStats,
  getStatsByAssistLevel,
  getStatsForDifficulty,
  saveGameResult,
} from "./stats.ts";

describe("stats", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stamps records with the app's local calendar date", () => {
    // date.ts is the single source of "today": toISOString() reports
    // the UTC date, which is tomorrow for an evening game in any
    // western timezone — the history list then shows the wrong day.
    const spy = vi
      .spyOn(dateModule, "todayLocalISO")
      .mockReturnValue("2001-02-03");
    try {
      saveGameResult("easy", "standard", 120, true);
      expect(getStats()[0]!.date).toBe("2001-02-03");
    } finally {
      spy.mockRestore();
    }
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

    it("filters by assist level when one is given", () => {
      saveGameResult("easy", "paper", 500, true);
      saveGameResult("easy", "standard", 100, true);
      saveGameResult("easy", "standard", 200, true);
      const result = getStatsForDifficulty("easy", "standard");
      expect(result).toEqual({
        gamesPlayed: 2,
        bestTime: 100,
        averageTime: 150,
      });
    });
  });

  describe("getStatsByAssistLevel", () => {
    it("returns an empty array when no wins exist for the difficulty", () => {
      saveGameResult("hard", "standard", 100, false);
      expect(getStatsByAssistLevel("hard")).toEqual([]);
    });

    it("returns one entry per played mode in paper/standard/full order", () => {
      saveGameResult("medium", "full", 90, true);
      saveGameResult("medium", "paper", 400, true);
      const levels = getStatsByAssistLevel("medium").map((s) => s.assistLevel);
      expect(levels).toEqual(["paper", "full"]);
    });

    it("computes best and average independently per mode", () => {
      saveGameResult("easy", "paper", 300, true);
      saveGameResult("easy", "paper", 500, true);
      saveGameResult("easy", "standard", 100, true);
      const byLevel = getStatsByAssistLevel("easy");
      expect(byLevel.find((s) => s.assistLevel === "paper")).toEqual({
        assistLevel: "paper",
        gamesPlayed: 2,
        bestTime: 300,
        averageTime: 400,
      });
      expect(byLevel.find((s) => s.assistLevel === "standard")).toEqual({
        assistLevel: "standard",
        gamesPlayed: 1,
        bestTime: 100,
        averageTime: 100,
      });
    });
  });
});
