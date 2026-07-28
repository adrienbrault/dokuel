import { beforeEach, describe, expect, it } from "vitest";
import {
  getMultiplayerStats,
  getMultiplayerStatsForDifficulty,
  getMultiplayerSummary,
  saveMultiplayerGameResult,
} from "./multiplayer-stats.ts";

const BASE_RECORD = {
  difficulty: "medium" as const,
  assistLevel: "standard" as const,
  time: 240,
  date: "2026-05-19",
  timestamp: 1_700_000_000_000,
  won: true,
  opponentName: "Brave Otter",
  roomId: "room-abc",
  gameNumber: 1,
};

describe("multiplayer-stats", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getMultiplayerStats", () => {
    it("returns empty array when nothing stored", () => {
      expect(getMultiplayerStats()).toEqual([]);
    });

    it("returns empty array when storage has invalid JSON", () => {
      localStorage.setItem("sudoku_multiplayer_stats", "{not json");
      expect(getMultiplayerStats()).toEqual([]);
    });

    it("returns empty array for parseable non-array data", () => {
      // "{}" parses fine; the old code returned it and every caller's
      // .some/.filter then threw.
      for (const bad of ["{}", "null", "42", '"x"']) {
        localStorage.setItem("sudoku_multiplayer_stats", bad);
        expect(getMultiplayerStats()).toEqual([]);
      }
    });
  });

  describe("saveMultiplayerGameResult", () => {
    it("persists a record so it can be retrieved", () => {
      saveMultiplayerGameResult(BASE_RECORD);
      expect(getMultiplayerStats()).toEqual([BASE_RECORD]);
    });

    it("appends multiple records in insertion order", () => {
      saveMultiplayerGameResult({ ...BASE_RECORD, gameNumber: 1 });
      saveMultiplayerGameResult({ ...BASE_RECORD, gameNumber: 2, won: false });
      const all = getMultiplayerStats();
      expect(all).toHaveLength(2);
      expect(all[0]!.gameNumber).toBe(1);
      expect(all[1]!.gameNumber).toBe(2);
    });

    it("deduplicates by roomId + gameNumber", () => {
      saveMultiplayerGameResult(BASE_RECORD);
      saveMultiplayerGameResult({ ...BASE_RECORD, time: 999 });
      const all = getMultiplayerStats();
      expect(all).toHaveLength(1);
      expect(all[0]!.time).toBe(240);
    });

    it("corrects the outcome when the same game is re-reported with a different winner", () => {
      // A near-simultaneous finish records optimistically on both
      // sides; when the CRDT merge settles the loser must be able to
      // overwrite its own premature won:true.
      saveMultiplayerGameResult(BASE_RECORD);
      saveMultiplayerGameResult({ ...BASE_RECORD, won: false, time: 251 });
      const all = getMultiplayerStats();
      expect(all).toHaveLength(1);
      expect(all[0]!.won).toBe(false);
    });

    it("trims to the last 100 entries", () => {
      for (let i = 0; i < 105; i++) {
        saveMultiplayerGameResult({
          ...BASE_RECORD,
          gameNumber: i,
          roomId: `room-${i}`,
        });
      }
      const all = getMultiplayerStats();
      expect(all).toHaveLength(100);
      expect(all[0]!.gameNumber).toBe(5);
    });
  });

  describe("getMultiplayerSummary", () => {
    it("returns zeros when no games", () => {
      expect(getMultiplayerSummary()).toEqual({
        played: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
      });
    });

    it("counts wins, losses, and win rate across all difficulties", () => {
      saveMultiplayerGameResult({ ...BASE_RECORD, gameNumber: 1, won: true });
      saveMultiplayerGameResult({ ...BASE_RECORD, gameNumber: 2, won: true });
      saveMultiplayerGameResult({ ...BASE_RECORD, gameNumber: 3, won: false });
      expect(getMultiplayerSummary()).toEqual({
        played: 3,
        wins: 2,
        losses: 1,
        winRate: 0.6666666666666666,
      });
    });
  });

  describe("getMultiplayerStatsForDifficulty", () => {
    it("returns null when there are no games for that difficulty", () => {
      saveMultiplayerGameResult({ ...BASE_RECORD, difficulty: "easy" });
      expect(getMultiplayerStatsForDifficulty("hard")).toBeNull();
    });

    it("reports played, wins, losses, win rate, and best winning time", () => {
      saveMultiplayerGameResult({
        ...BASE_RECORD,
        gameNumber: 1,
        difficulty: "hard",
        won: true,
        time: 300,
      });
      saveMultiplayerGameResult({
        ...BASE_RECORD,
        gameNumber: 2,
        difficulty: "hard",
        won: true,
        time: 180,
      });
      saveMultiplayerGameResult({
        ...BASE_RECORD,
        gameNumber: 3,
        difficulty: "hard",
        won: false,
        time: 420,
      });
      // Other difficulty should not pollute the result
      saveMultiplayerGameResult({
        ...BASE_RECORD,
        gameNumber: 4,
        difficulty: "easy",
        won: true,
        time: 60,
      });

      expect(getMultiplayerStatsForDifficulty("hard")).toEqual({
        played: 3,
        wins: 2,
        losses: 1,
        winRate: 2 / 3,
        bestWinTime: 180,
      });
    });

    it("omits bestWinTime when there are no wins for the difficulty", () => {
      saveMultiplayerGameResult({
        ...BASE_RECORD,
        difficulty: "expert",
        won: false,
      });
      expect(getMultiplayerStatsForDifficulty("expert")).toEqual({
        played: 1,
        wins: 0,
        losses: 1,
        winRate: 0,
        bestWinTime: null,
      });
    });
  });
});
