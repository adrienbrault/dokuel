import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  exportBackup,
  importBackup,
  previewBackup,
  validateBackup,
} from "./backup.ts";
import { getDailyStreak, recordDailyCompletion } from "./daily-streak.ts";
import { loadGame, type SavedGame, saveGame } from "./game-storage.ts";
import {
  getTechniqueProgress,
  recordTechniquePractice,
} from "./learning-progress.ts";
import {
  getMultiplayerStats,
  getMultiplayerSummary,
  saveMultiplayerGameResult,
} from "./multiplayer-stats.ts";
import { recordResult } from "./result-store.ts";

const VALID_GAME: SavedGame = {
  puzzle: ".".repeat(81),
  values: ".".repeat(81),
  notes: Array.from({ length: 81 }, () => []),
  timer: 42,
  difficulty: "medium",
  assistLevel: "standard",
  hintsUsed: 0,
};

describe("progress backup", () => {
  beforeEach(() => localStorage.clear());

  it("exports a versioned previewable bundle without multiplayer identity", () => {
    saveGame("solo", VALID_GAME);
    saveGame("mp_room_2_player_puzzle", {
      ...VALID_GAME,
      multiplayer: {
        roomId: "private-room",
        playerId: "private-player",
        gameNumber: 2,
        puzzle: VALID_GAME.puzzle,
      },
    });
    recordResult({
      difficulty: "medium",
      assistLevel: "standard",
      time: 42,
      won: true,
      metadata: { origin: "generated", attemptId: "attempt" },
    });
    recordDailyCompletion("2026-03-08");
    recordTechniquePractice("naked-single", true);

    const backup = exportBackup();
    const preview = previewBackup(JSON.stringify(backup));

    expect(backup.version).toBe(1);
    expect(JSON.stringify(backup)).not.toContain("private-player");
    expect(preview).toMatchObject({
      savedGames: 1,
      resultCount: 1,
      lifetimeGamesPlayed: 1,
      currentStreak: 1,
      longestStreak: 1,
    });
  });

  it("restores saves, results, streaks, and learning progress as one replacement", () => {
    saveGame("solo", VALID_GAME);
    recordResult({
      difficulty: "medium",
      assistLevel: "standard",
      time: 42,
      won: true,
      metadata: { origin: "friend", attemptId: "attempt" },
    });
    recordDailyCompletion("2026-03-08");
    recordTechniquePractice("naked-single", true);
    const backup = exportBackup();

    localStorage.clear();
    expect(importBackup(JSON.stringify(backup))).toBe(true);
    expect(loadGame("solo")).toEqual(VALID_GAME);
    expect(previewBackup(exportBackup())).toMatchObject({
      savedGames: 1,
      resultCount: 1,
      currentStreak: 1,
    });
    expect(getTechniqueProgress()["naked-single"]?.solved).toBe(1);
  });

  it("rejects an unknown version without replacing current progress", () => {
    saveGame("keep", VALID_GAME);
    const backup = exportBackup();
    const invalid = { ...backup, version: 2 };

    expect(previewBackup(invalid)).toBeNull();
    expect(importBackup(invalid)).toBe(false);
    expect(loadGame("keep")).toEqual(VALID_GAME);
  });

  it("rejects unknown artifact fields before any replacement", () => {
    saveGame("keep", VALID_GAME);
    const backup = exportBackup();
    expect(previewBackup({ ...backup, roomId: "private-room" })).toBeNull();
    expect(importBackup({ ...backup, roomId: "private-room" })).toBe(false);
    expect(loadGame("keep")).toEqual(VALID_GAME);
  });

  it("rejects malformed files and nested modules before replacing progress", () => {
    saveGame("keep", VALID_GAME);
    const backup = exportBackup();
    const invalidBackups: unknown[] = [
      "not json",
      null,
      42,
      {},
      { ...backup, version: 2 },
      { ...backup, savedGames: null },
      { ...backup, resultStore: null },
      { ...backup, resultStore: { ...backup.resultStore, recent: null } },
      {
        ...backup,
        dailyStreak: { ...backup.dailyStreak, lifetime: null },
      },
      {
        ...backup,
        learningProgress: {
          ...backup.learningProgress,
          "naked-single": { attempts: -1, solved: 0 },
        },
      },
      {
        ...backup,
        multiplayerStats: {
          version: 2,
          recent: [],
          lifetime: { version: 1, buckets: {} },
        },
      },
    ];
    for (const invalid of [
      ...invalidBackups,
      { ...backup, resultStore: undefined },
      JSON.stringify({ ...backup, dailyStreak: null }),
    ]) {
      expect(validateBackup(invalid)).toBeNull();
      expect(previewBackup(invalid)).toBeNull();
      expect(importBackup(invalid)).toBe(false);
    }

    expect(loadGame("keep")).toEqual(VALID_GAME);
    expect(exportBackup()).toEqual(backup);
  });

  it("backs up multiplayer results without room identity and restores them locally", () => {
    saveMultiplayerGameResult({
      difficulty: "hard",
      assistLevel: "standard",
      time: 95,
      date: "2026-03-08",
      timestamp: 1_000,
      won: true,
      opponentName: "Brave Otter",
      roomId: "private-room",
      gameNumber: 4,
    });

    const backup = exportBackup();
    expect(backup.multiplayerStats?.recent).toEqual([
      expect.objectContaining({
        difficulty: "hard",
        opponentName: "Brave Otter",
        time: 95,
      }),
    ]);
    expect(backup.multiplayerStats?.recent[0]).not.toHaveProperty("roomId");
    expect(backup.multiplayerStats?.recent[0]).not.toHaveProperty("gameNumber");
    expect(JSON.stringify(backup)).not.toContain("private-room");
    expect(previewBackup(backup)).toMatchObject({
      multiplayerResultCount: 1,
      multiplayerGamesPlayed: 1,
    });

    localStorage.clear();
    expect(importBackup(backup)).toBe(true);
    expect(getMultiplayerSummary()).toMatchObject({
      played: 1,
      wins: 1,
    });
    expect(getMultiplayerStats()[0]).toMatchObject({
      opponentName: "Brave Otter",
      difficulty: "hard",
    });
    expect(getMultiplayerStats()[0]?.roomId).not.toBe("private-room");
  });

  it("keeps multiplayer results when importing an older v1 backup", () => {
    saveMultiplayerGameResult({
      difficulty: "easy",
      assistLevel: "paper",
      time: 120,
      date: "2026-03-08",
      timestamp: 2_000,
      won: false,
      opponentName: "Clever Fox",
      roomId: "keep-room",
      gameNumber: 1,
    });
    const backup = exportBackup();
    delete backup.multiplayerStats;

    expect(importBackup(backup)).toBe(true);
    expect(getMultiplayerSummary()).toMatchObject({ played: 1, wins: 0 });
  });

  it("rolls back saved games when a later bundle write fails", () => {
    saveGame("keep", VALID_GAME);
    const before = exportBackup();
    const incoming = {
      ...before,
      savedGames: [{ key: "replacement", data: VALID_GAME }],
    };
    const originalSetItem = Storage.prototype.setItem;
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key, value) {
        if (key === "sudoku_result_store") throw new Error("quota");
        return originalSetItem.call(this, key, value);
      });
    try {
      expect(importBackup(incoming)).toBe(false);
    } finally {
      spy.mockRestore();
    }

    expect(loadGame("keep")).toEqual(VALID_GAME);
    expect(loadGame("replacement")).toBeNull();
  });

  it("rolls back every changed domain when learning restore fails", () => {
    saveGame("keep", VALID_GAME);
    recordResult({
      difficulty: "medium",
      assistLevel: "standard",
      time: 42,
      won: true,
      metadata: { origin: "generated", attemptId: "before" },
    });
    recordDailyCompletion("2026-03-08");
    recordTechniquePractice("naked-single", true);
    const before = exportBackup();

    const incoming = {
      ...before,
      savedGames: [{ key: "replacement", data: VALID_GAME }],
      resultStore: {
        ...before.resultStore,
        recent: [],
        attempts: {},
        lifetime: { version: 1 as const, buckets: {} },
      },
    };
    const originalSetItem = Storage.prototype.setItem;
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key, value) {
        if (key === "sudoku_learning_progress") throw new Error("quota");
        return originalSetItem.call(this, key, value);
      });
    try {
      expect(importBackup(incoming)).toBe(false);
    } finally {
      spy.mockRestore();
    }

    expect(loadGame("keep")).toEqual(VALID_GAME);
    expect(loadGame("replacement")).toBeNull();
    expect(previewBackup(exportBackup())).toMatchObject({
      savedGames: 1,
      resultCount: 1,
      currentStreak: 1,
      learningAttempts: 1,
    });
    expect(getDailyStreak().completedDates).toContain("2026-03-08");
    expect(getTechniqueProgress()["naked-single"]).toEqual({
      attempts: 1,
      solved: 1,
    });
  });

  it("restores multiplayer results when a later bundle write fails", () => {
    saveMultiplayerGameResult({
      difficulty: "easy",
      assistLevel: "standard",
      time: 120,
      date: "2026-03-08",
      timestamp: 1_000,
      won: true,
      opponentName: "First Fox",
      roomId: "first-room",
      gameNumber: 1,
    });
    const before = exportBackup();

    saveMultiplayerGameResult({
      difficulty: "easy",
      assistLevel: "standard",
      time: 90,
      date: "2026-03-09",
      timestamp: 2_000,
      won: true,
      opponentName: "Second Fox",
      roomId: "second-room",
      gameNumber: 2,
    });
    const incoming = exportBackup();
    expect(importBackup(before)).toBe(true);

    const originalSetItem = Storage.prototype.setItem;
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key, value) {
        if (key === "sudoku_learning_progress") throw new Error("quota");
        return originalSetItem.call(this, key, value);
      });
    try {
      expect(importBackup(incoming)).toBe(false);
    } finally {
      spy.mockRestore();
    }

    expect(getMultiplayerSummary()).toMatchObject({ played: 1, wins: 1 });
    expect(getMultiplayerStats()).toHaveLength(1);
    expect(getMultiplayerStats()[0]?.opponentName).toBe("First Fox");
  });
});
