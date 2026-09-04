import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportBackup, importBackup, previewBackup } from "./backup.ts";
import { getDailyStreak, recordDailyCompletion } from "./daily-streak.ts";
import { loadGame, type SavedGame, saveGame } from "./game-storage.ts";
import {
  getTechniqueProgress,
  recordTechniquePractice,
} from "./learning-progress.ts";
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
});
