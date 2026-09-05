import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDailyResult } from "./daily-results.ts";
import { isDailyCompleted } from "./daily-streak.ts";
import { todayLocalISO } from "./date.ts";
import { completeGame } from "./game-completion.ts";
import { loadGame, saveGame } from "./game-storage.ts";
import { getStatsForDifficulty } from "./stats.ts";

describe("completeGame", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

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
    // bestTime falls back to all games when no hint-free run exists
    expect(stats!.bestTime).toBe(300);
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

  it("records a result for today's daily as well as the streak", () => {
    const date = todayLocalISO();

    completeGame({
      difficulty: "medium",
      assistLevel: "standard",
      timeSeconds: 250,
      hintsUsed: 0,
      dailyDate: date,
    });

    expect(getDailyResult(date)?.time).toBe(250);
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
