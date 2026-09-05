import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  exportMultiplayerStats,
  getMultiplayerStats,
  getMultiplayerStatsForDifficulty,
  getMultiplayerSummary,
  importMultiplayerStats,
  saveMultiplayerGameResult,
  validateMultiplayerStatsBackup,
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

    it("migrates legacy rows while retaining evicted lifetime matches", () => {
      const legacy = Array.from({ length: 105 }, (_, index) => ({
        ...BASE_RECORD,
        roomId: `legacy-${index}`,
        gameNumber: index,
        time: 100 + index,
      }));
      localStorage.setItem("sudoku_multiplayer_stats", JSON.stringify(legacy));

      expect(getMultiplayerStats()).toHaveLength(100);
      expect(getMultiplayerSummary()).toMatchObject({
        played: 105,
        wins: 105,
      });

      const first = legacy[0];
      if (!first) return;
      saveMultiplayerGameResult({
        ...first,
        won: false,
        time: 500,
      });
      expect(getMultiplayerSummary()).toMatchObject({
        played: 105,
        wins: 104,
        losses: 1,
      });
    });

    it("ignores an invalid versioned envelope instead of throwing", () => {
      localStorage.setItem(
        "sudoku_multiplayer_stats",
        JSON.stringify({
          version: 1,
          recent: [],
          lifetime: { version: 1, buckets: {} },
          matches: [],
          indexComplete: true,
        }),
      );
      expect(getMultiplayerStats()).toEqual([]);
      expect(getMultiplayerSummary()).toEqual({
        played: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
      });
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
      expect(all[0]?.gameNumber).toBe(1);
      expect(all[1]?.gameNumber).toBe(2);
    });

    it("deduplicates by roomId + gameNumber", () => {
      saveMultiplayerGameResult(BASE_RECORD);
      saveMultiplayerGameResult({ ...BASE_RECORD, time: 999 });
      const all = getMultiplayerStats();
      expect(all).toHaveLength(1);
      expect(all[0]?.time).toBe(240);
    });

    it("corrects the outcome when the same game is re-reported with a different winner", () => {
      // A near-simultaneous finish records optimistically on both
      // sides; when the CRDT merge settles the loser must be able to
      // overwrite its own premature won:true.
      saveMultiplayerGameResult(BASE_RECORD);
      saveMultiplayerGameResult({ ...BASE_RECORD, won: false, time: 251 });
      const all = getMultiplayerStats();
      expect(all).toHaveLength(1);
      expect(all[0]?.won).toBe(false);
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
      expect(all[0]?.gameNumber).toBe(5);
    });

    it("keeps a difficulty's best win when another difficulty floods the history", () => {
      saveMultiplayerGameResult({
        ...BASE_RECORD,
        difficulty: "easy",
        time: 90,
        roomId: "room-pb",
      });
      for (let i = 0; i < 120; i++) {
        saveMultiplayerGameResult({
          ...BASE_RECORD,
          difficulty: "medium",
          time: 500 + i,
          roomId: `flood-${i}`,
        });
      }

      expect(getMultiplayerStatsForDifficulty("easy")?.bestWinTime).toBe(90);
    });

    it("keeps lifetime totals after recent matches are capped", () => {
      for (let i = 0; i < 105; i++) {
        saveMultiplayerGameResult({
          ...BASE_RECORD,
          gameNumber: i,
          roomId: `lifetime-${i}`,
          time: 500 - i,
        });
      }

      expect(getMultiplayerStats()).toHaveLength(100);
      expect(getMultiplayerSummary()).toMatchObject({
        played: 105,
        wins: 105,
        winRate: 1,
      });
      expect(getMultiplayerStatsForDifficulty("medium")?.bestWinTime).toBe(396);
    });

    it("corrects a photo finish after the match leaves recent history", () => {
      saveMultiplayerGameResult({
        ...BASE_RECORD,
        roomId: "evicted-photo-finish",
        time: 90,
      });
      for (let i = 0; i < 100; i++) {
        saveMultiplayerGameResult({
          ...BASE_RECORD,
          roomId: `loss-${i}`,
          gameNumber: i,
          won: false,
        });
      }

      expect(getMultiplayerStats()).toHaveLength(100);
      saveMultiplayerGameResult({
        ...BASE_RECORD,
        roomId: "evicted-photo-finish",
        won: false,
        time: 91,
      });

      expect(getMultiplayerSummary()).toEqual({
        played: 101,
        wins: 0,
        losses: 101,
        winRate: 0,
      });
      expect(getMultiplayerStatsForDifficulty("medium")?.bestWinTime).toBe(
        null,
      );
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

    describe("portable multiplayer results", () => {
      it("exports recent rows without room and game identity", () => {
        saveMultiplayerGameResult(BASE_RECORD);

        const backup = exportMultiplayerStats();
        expect(backup).toMatchObject({ version: 1 });
        expect(backup.recent).toEqual([
          expect.objectContaining({
            difficulty: "medium",
            opponentName: "Brave Otter",
          }),
        ]);
        expect(backup.recent[0]).not.toHaveProperty("roomId");
        expect(backup.recent[0]).not.toHaveProperty("gameNumber");
        expect(backup.lifetime.buckets.medium).toMatchObject({
          gamesPlayed: 1,
          wins: 1,
          bestWinTime: 240,
        });
      });

      it("rejects portable rows that smuggle room identity or contradict lifetime", () => {
        saveMultiplayerGameResult(BASE_RECORD);
        const backup = exportMultiplayerStats();
        const row = backup.recent[0];
        expect(row).toBeDefined();
        if (!row) return;

        expect(
          validateMultiplayerStatsBackup({
            ...backup,
            recent: [{ ...row, roomId: "private-room" }],
          }),
        ).toBeNull();

        expect(
          validateMultiplayerStatsBackup({
            ...backup,
            lifetime: {
              ...backup.lifetime,
              buckets: {
                ...backup.lifetime.buckets,
                medium: {
                  ...backup.lifetime.buckets.medium,
                  gamesPlayed: 0,
                },
              },
            },
          }),
        ).toBeNull();
      });

      it("imports portable rows with a local synthetic identity", () => {
        saveMultiplayerGameResult(BASE_RECORD);
        const backup = exportMultiplayerStats();
        localStorage.clear();

        expect(importMultiplayerStats(backup)).toBe(true);
        expect(getMultiplayerSummary()).toMatchObject({ played: 1, wins: 1 });
        expect(getMultiplayerStats()[0]).toMatchObject({
          opponentName: "Brave Otter",
        });
        expect(getMultiplayerStats()[0]?.roomId).not.toBe(BASE_RECORD.roomId);
      });

      it("keeps current results when a portable import cannot be written", () => {
        saveMultiplayerGameResult(BASE_RECORD);
        const before = exportMultiplayerStats();
        const originalSetItem = Storage.prototype.setItem;
        const spy = vi
          .spyOn(Storage.prototype, "setItem")
          .mockImplementation(() => {
            throw new Error("quota");
          });
        try {
          expect(importMultiplayerStats(before)).toBe(false);
        } finally {
          spy.mockRestore();
          Storage.prototype.setItem = originalSetItem;
        }
        expect(exportMultiplayerStats()).toEqual(before);
      });

      it("validates JSON strings and rejects malformed result fields", () => {
        saveMultiplayerGameResult(BASE_RECORD);
        const backup = exportMultiplayerStats();
        const row = backup.recent[0];
        expect(row).toBeDefined();
        if (!row) return;

        expect(validateMultiplayerStatsBackup("{broken")).toBeNull();
        expect(
          validateMultiplayerStatsBackup({ ...backup, version: 2 }),
        ).toBeNull();
        expect(
          validateMultiplayerStatsBackup({
            ...backup,
            recent: [{ ...row, time: Number.POSITIVE_INFINITY }],
          }),
        ).toBeNull();
        expect(
          validateMultiplayerStatsBackup({
            ...backup,
            recent: [{ ...row, won: "true" }],
          }),
        ).toBeNull();
        expect(
          validateMultiplayerStatsBackup({
            ...backup,
            lifetime: {
              ...backup.lifetime,
              buckets: {
                ...backup.lifetime.buckets,
                medium: {
                  ...backup.lifetime.buckets.medium,
                  bestWinTime: null,
                },
              },
            },
          }),
        ).toBeNull();
      });

      it("restores a detached named history snapshot", () => {
        saveMultiplayerGameResult(BASE_RECORD);
        const backup = exportMultiplayerStats();
        const exportedRow = backup.recent[0];
        if (!exportedRow) return;
        exportedRow.opponentName = "Changed copy";
        backup.lifetime.buckets.medium.gamesPlayed = 99;

        expect(exportMultiplayerStats()).toMatchObject({
          recent: [expect.objectContaining({ opponentName: "Brave Otter" })],
          lifetime: {
            buckets: { medium: { gamesPlayed: 1 } },
          },
        });
      });

      it("uses synthetic identity for imported rows without double counting", () => {
        saveMultiplayerGameResult(BASE_RECORD);
        const backup = exportMultiplayerStats();
        localStorage.clear();
        expect(importMultiplayerStats(backup)).toBe(true);
        const imported = getMultiplayerStats()[0];
        expect(imported).toBeDefined();
        if (!imported) return;

        saveMultiplayerGameResult({
          ...BASE_RECORD,
          roomId: imported.roomId,
          gameNumber: imported.gameNumber,
          won: false,
          time: 251,
        });
        expect(getMultiplayerSummary()).toEqual({
          played: 1,
          wins: 0,
          losses: 1,
          winRate: 0,
        });
        expect(getMultiplayerStats()[0]?.won).toBe(false);
      });
    });
  });
});
