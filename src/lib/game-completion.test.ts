import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isDailyCompleted } from "./daily-streak.ts";
import { completeGame } from "./game-completion.ts";
import { loadGame, saveGame } from "./game-storage.ts";
// biome-ignore lint/performance/noNamespaceImport: spyOn needs the module namespace
import * as productEvents from "./product-events.ts";
import { getStats, getStatsForDifficulty, saveGameResult } from "./stats.ts";

describe("completeGame", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("returns updated statistics and the personal-best decision for the completed game", () => {
    saveGameResult("easy", "standard", 60, true, 0);
    const result = completeGame({
      difficulty: "easy",
      assistLevel: "standard",
      timeSeconds: 30,
      hintsUsed: 0,
    });
    expect(result).toMatchObject({
      stats: { gamesPlayed: 2, bestTime: 30, averageTime: 45 },
      isNewPB: true,
      assistLevel: "standard",
      timeSeconds: 30,
    });
  });

  it("keeps friend provenance out of the normal personal-best table", async () => {
    const { getStats } = await import("./stats.ts");
    const result = completeGame({
      gameKey: "friend-attempt",
      attemptId: "friend-attempt",
      puzzleId: "friend-puzzle",
      origin: "friend",
      difficulty: "expert",
      assistLevel: "standard",
      timeSeconds: 1,
      hintsUsed: 0,
    });

    expect(result.isNewPB).toBe(false);
    expect(getStats()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attemptId: "friend-attempt",
          puzzleId: "friend-puzzle",
          origin: "friend",
        }),
      ]),
    );
    expect(getStatsForDifficulty("expert", "standard")).toBeNull();
  });

  it("accepts an attempt id that matches an object prototype property", () => {
    const result = completeGame({
      gameKey: "toString",
      attemptId: "toString",
      puzzleId: "prototype-key-puzzle",
      difficulty: "easy",
      assistLevel: "standard",
      timeSeconds: 30,
      hintsUsed: 0,
    });

    expect(result).toMatchObject({
      stats: { gamesPlayed: 1, bestTime: 30 },
      isNewPB: true,
    });
  });

  it("records a stable attempt only once across repeated completions", () => {
    const context = {
      gameKey: "repeatable-attempt",
      attemptId: "repeatable-attempt",
      puzzleId: "repeatable-puzzle",
      difficulty: "easy" as const,
      assistLevel: "standard" as const,
      timeSeconds: 30,
      hintsUsed: 0,
    };

    const first = completeGame(context);
    const second = completeGame({ ...context, timeSeconds: 1 });

    expect(first.stats).toMatchObject({ gamesPlayed: 1, bestTime: 30 });
    expect(second.stats).toMatchObject({ gamesPlayed: 1, bestTime: 30 });
    expect(second.isNewPB).toBe(false);
    expect(
      JSON.parse(localStorage.getItem("sudoku_result_store") ?? "{}").attempts[
        "repeatable-attempt"
      ],
    ).toMatchObject({ time: 30, puzzleId: "repeatable-puzzle" });
  });

  it("does not mark a faster repeat of a puzzle as a generated personal best", () => {
    completeGame({
      gameKey: "first-generated",
      attemptId: "first-generated",
      puzzleId: "replayed-puzzle",
      difficulty: "easy",
      assistLevel: "standard",
      timeSeconds: 90,
      hintsUsed: 0,
    });
    const replay = completeGame({
      gameKey: "second-generated",
      attemptId: "second-generated",
      puzzleId: "replayed-puzzle",
      difficulty: "easy",
      assistLevel: "standard",
      timeSeconds: 1,
      hintsUsed: 0,
    });

    expect(replay.isNewPB).toBe(false);
    expect(getStatsForDifficulty("easy", "standard")).toMatchObject({
      gamesPlayed: 1,
      bestTime: 90,
    });
    expect(getStatsForDifficulty("easy", "standard", "replay")).toMatchObject({
      gamesPlayed: 1,
      bestTime: 1,
    });
  });

  it("tracks only durable first completions with a privacy-safe product mode", () => {
    const track = vi.spyOn(productEvents, "trackProductEvent");
    const context = {
      gameKey: "event-attempt",
      attemptId: "event-attempt",
      puzzleId: "event-puzzle",
      origin: "friend" as const,
      difficulty: "easy" as const,
      assistLevel: "standard" as const,
      timeSeconds: 121,
      hintsUsed: 0,
    };
    completeGame(context);
    completeGame({ ...context, timeSeconds: 1 });

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("game_complete", "friend", 121);
    track.mockRestore();
  });

  it("floors the completion receipt while retaining precise recorded time", () => {
    const result = completeGame({
      difficulty: "easy",
      assistLevel: "standard",
      timeSeconds: 12.75,
      hintsUsed: 0,
    });

    expect(result.timeSeconds).toBe(12);
    expect(getStats()[0]?.time).toBe(12.75);
  });

  it("survives a throwing localStorage at the moment of winning", async () => {
    // Quota exhaustion / blocked storage throws on setItem. This runs
    // inside the completion effect — an unhandled throw here crashes
    // the app exactly at the win, and loses the streak increment that
    // would have followed the stats write.
    const { vi } = await import("vitest");
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    try {
      expect(() =>
        completeGame({
          difficulty: "easy",
          assistLevel: "standard",
          timeSeconds: 60,
          hintsUsed: 0,
          dailyDate: "2026-07-28",
        }),
      ).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });

  it("keeps the autosave when the result envelope cannot be persisted", async () => {
    const { vi } = await import("vitest");
    saveGame("failed-result", {
      puzzle: ".".repeat(81),
      values: ".".repeat(81),
      notes: Array.from({ length: 81 }, () => []),
      timer: 12,
      difficulty: "easy",
      assistLevel: "standard",
      hintsUsed: 0,
    });
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    try {
      completeGame({
        gameKey: "failed-result",
        attemptId: "failed-result",
        difficulty: "easy",
        assistLevel: "standard",
        timeSeconds: 30,
        hintsUsed: 0,
      });
    } finally {
      spy.mockRestore();
    }

    expect(loadGame("failed-result")).not.toBeNull();
  });

  it("deletes the autosave when a gameKey is given", () => {
    saveGame("active-easy", {
      puzzle: ".".repeat(81),
      values: ".".repeat(81),
      notes: Array.from({ length: 81 }, () => []),
      timer: 0,
      difficulty: "easy",
      assistLevel: "standard",
      hintsUsed: 0,
    });

    completeGame({
      gameKey: "active-easy",
      difficulty: "easy",
      assistLevel: "standard",
      timeSeconds: 60,
      hintsUsed: 0,
    });

    expect(loadGame("active-easy")).toBeNull();
  });

  it("records a per-difficulty stats entry with timer and hint count", () => {
    completeGame({
      difficulty: "hard",
      assistLevel: "standard",
      timeSeconds: 300,
      hintsUsed: 2,
    });

    const stats = getStatsForDifficulty("hard");
    expect(stats).not.toBeNull();
    expect(stats!.gamesPlayed).toBe(1);
    // Hint-assisted wins count toward history, but not personal bests.
    expect(stats!.bestTime).toBeNull();
  });

  it("returns no streak when dailyDate is omitted", () => {
    const result = completeGame({
      difficulty: "medium",
      assistLevel: "standard",
      timeSeconds: 100,
      hintsUsed: 0,
    });

    expect(result.streak).toBeUndefined();
  });

  it("records the daily streak and returns it when dailyDate is given", () => {
    const date = "2026-05-16";

    const result = completeGame({
      difficulty: "medium",
      assistLevel: "standard",
      timeSeconds: 100,
      hintsUsed: 0,
      dailyDate: date,
    });

    expect(result.streak).toBeDefined();
    expect(result.streak!.currentStreak).toBe(1);
    expect(result.streak!.lastCompletedDate).toBe(date);
    expect(isDailyCompleted(date)).toBe(true);
  });

  it("is safe to call without a gameKey (no autosave to delete)", () => {
    expect(() =>
      completeGame({
        difficulty: "easy",
        assistLevel: "standard",
        timeSeconds: 30,
        hintsUsed: 0,
      }),
    ).not.toThrow();
  });
});
