import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isDailyCompleted } from "./daily-streak.ts";
import { completeGame } from "./game-completion.ts";
import { loadGame, saveGame } from "./game-storage.ts";
import { getStatsForDifficulty } from "./stats.ts";

describe("completeGame", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("deletes the autosave when a gameKey is given", () => {
    saveGame("active-easy", {
      puzzle: ".".repeat(81),
      values: ".".repeat(81),
      notes: Array.from({ length: 81 }, () => []),
      timer: 0,
      difficulty: "easy",
      assistLevel: "standard",
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
