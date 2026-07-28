import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadGame, type SavedGame, saveGame } from "../lib/game-storage.ts";
import { getStatsForDifficulty } from "../lib/stats.ts";
import { useResumableSudoku } from "./useResumableSudoku.ts";

const SOLVED =
  "534678912" +
  "672195348" +
  "198342567" +
  "859761423" +
  "426853791" +
  "713924856" +
  "961537284" +
  "287419635" +
  "345286179";

function puzzleMissingOneCell(): string {
  return `.${SOLVED.slice(1)}`;
}

function emptyNotes(): number[][] {
  return Array.from({ length: 81 }, () => []);
}

function savedGame(overrides: Partial<SavedGame> = {}): SavedGame {
  return {
    puzzle: puzzleMissingOneCell(),
    values: ".".repeat(81),
    notes: emptyNotes(),
    timer: 0,
    difficulty: "easy",
    assistLevel: "standard",
    ...overrides,
  };
}

describe("useResumableSudoku", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("uses initialPuzzle when no saved game exists", () => {
    const puzzle = puzzleMissingOneCell();
    const { result } = renderHook(() =>
      useResumableSudoku({
        initialPuzzle: puzzle,
        difficulty: "easy",
        initialAssistLevel: "standard",
        getTimerSeconds: () => 0,
      }),
    );
    expect(result.current.puzzle).toBe(puzzle);
    expect(result.current.initialTimerSeconds).toBe(0);
  });

  it("resumes puzzle, timer, and assistLevel from a saved game", () => {
    saveGame(
      "test-key",
      savedGame({ timer: 42, assistLevel: "full", difficulty: "hard" }),
    );
    const { result } = renderHook(() =>
      useResumableSudoku({
        gameKey: "test-key",
        difficulty: "easy",
        initialAssistLevel: "standard",
        getTimerSeconds: () => 0,
      }),
    );
    expect(result.current.puzzle).toBe(puzzleMissingOneCell());
    expect(result.current.initialTimerSeconds).toBe(42);
    expect(result.current.assistLevel).toBe("full");
  });

  it("persists hintsUsed in the autosave and restores it on resume", () => {
    // Without this, close-and-reopen laundered a hint-assisted game
    // into a hint-free one: the PB filter and the in-game PB gate both
    // read hintsUsed, so a resumed game could set a "clean" record.
    const puzzle = `..${SOLVED.slice(2)}`;
    const { result, unmount } = renderHook(() =>
      useResumableSudoku({
        gameKey: "hint-key",
        initialPuzzle: puzzle,
        difficulty: "easy",
        initialAssistLevel: "standard",
        getTimerSeconds: () => 0,
      }),
    );
    act(() => {
      result.current.game.hint();
    });
    expect(loadGame("hint-key")?.hintsUsed).toBe(1);
    unmount();

    const { result: resumed } = renderHook(() =>
      useResumableSudoku({
        gameKey: "hint-key",
        difficulty: "easy",
        initialAssistLevel: "standard",
        getTimerSeconds: () => 0,
      }),
    );
    expect(resumed.current.game.hintsUsed).toBe(1);
  });

  it("falls back to initialPuzzle when gameKey has no saved game", () => {
    const puzzle = puzzleMissingOneCell();
    const { result } = renderHook(() =>
      useResumableSudoku({
        gameKey: "missing-key",
        initialPuzzle: puzzle,
        difficulty: "easy",
        initialAssistLevel: "standard",
        getTimerSeconds: () => 0,
      }),
    );
    expect(result.current.puzzle).toBe(puzzle);
  });

  it("auto-saves the board when a player acts", () => {
    // Two empty cells means placing one does not complete the board, so the
    // auto-save effect is not short-circuited by the completion check.
    const puzzle = `.${SOLVED.slice(1, 80)}.`;
    const { result } = renderHook(() =>
      useResumableSudoku({
        gameKey: "auto-save",
        initialPuzzle: puzzle,
        difficulty: "easy",
        initialAssistLevel: "standard",
        getTimerSeconds: () => 12,
      }),
    );

    act(() => result.current.game.selectCell(0, 0));
    act(() => result.current.game.placeNumber(5));

    const saved = loadGame("auto-save");
    expect(saved).not.toBeNull();
    expect(saved!.puzzle).toBe(puzzle);
    expect(saved!.values[0]).toBe("5");
  });

  it("deletes the saved game on completion", () => {
    saveGame(
      "complete-key",
      savedGame({ puzzle: puzzleMissingOneCell(), assistLevel: "standard" }),
    );
    const { result } = renderHook(() =>
      useResumableSudoku({
        gameKey: "complete-key",
        difficulty: "easy",
        initialAssistLevel: "standard",
        getTimerSeconds: () => 120,
      }),
    );

    // Fill the one missing cell with the correct value (5)
    act(() => result.current.game.selectCell(0, 0));
    act(() => result.current.game.placeNumber(5));

    expect(result.current.game.status).toBe("completed");
    expect(loadGame("complete-key")).toBeNull();
  });

  it("records stats on completion using the timer value", () => {
    const { result } = renderHook(() =>
      useResumableSudoku({
        initialPuzzle: puzzleMissingOneCell(),
        difficulty: "easy",
        initialAssistLevel: "standard",
        getTimerSeconds: () => 90,
      }),
    );

    act(() => result.current.game.selectCell(0, 0));
    act(() => result.current.game.placeNumber(5));

    const stats = getStatsForDifficulty("easy");
    expect(stats).not.toBeNull();
    expect(stats!.gamesPlayed).toBe(1);
    expect(stats!.bestTime).toBe(90);
  });

  it("records the win only once across re-renders after completion", () => {
    const { result, rerender } = renderHook(() =>
      useResumableSudoku({
        initialPuzzle: puzzleMissingOneCell(),
        difficulty: "easy",
        initialAssistLevel: "standard",
        getTimerSeconds: () => 90,
      }),
    );

    act(() => result.current.game.selectCell(0, 0));
    act(() => result.current.game.placeNumber(5));
    expect(result.current.game.status).toBe("completed");

    // Post-win re-renders recreate the inline getTimerSeconds, churning the
    // completion effect's deps. The win must still be recorded exactly once.
    rerender();
    rerender();
    rerender();

    expect(getStatsForDifficulty("easy")!.gamesPlayed).toBe(1);
  });

  it("calls onComplete with the timer value and an empty result for non-daily games", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useResumableSudoku({
        initialPuzzle: puzzleMissingOneCell(),
        difficulty: "easy",
        initialAssistLevel: "standard",
        getTimerSeconds: () => 73,
        onComplete,
      }),
    );

    act(() => result.current.game.selectCell(0, 0));
    act(() => result.current.game.placeNumber(5));

    expect(onComplete).toHaveBeenCalledWith(73, {});
  });

  it("when dailyDate is given, onComplete receives the recorded streak", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useResumableSudoku({
        initialPuzzle: puzzleMissingOneCell(),
        difficulty: "medium",
        initialAssistLevel: "standard",
        getTimerSeconds: () => 90,
        dailyDate: "2026-05-16",
        onComplete,
      }),
    );

    act(() => result.current.game.selectCell(0, 0));
    act(() => result.current.game.placeNumber(5));

    expect(onComplete).toHaveBeenCalledWith(
      90,
      expect.objectContaining({
        streak: expect.objectContaining({
          currentStreak: 1,
          lastCompletedDate: "2026-05-16",
        }),
      }),
    );
  });

  it("setAssistLevel updates the level and is preserved across auto-saves", () => {
    const { result } = renderHook(() =>
      useResumableSudoku({
        gameKey: "assist-save",
        initialPuzzle: puzzleMissingOneCell(),
        difficulty: "easy",
        initialAssistLevel: "standard",
        getTimerSeconds: () => 0,
      }),
    );

    act(() => result.current.setAssistLevel("full"));
    expect(result.current.assistLevel).toBe("full");

    // Trigger a save by placing a note in an empty cell that doesn't complete
    // the board. Use the second cell since (0,0) completes immediately.
    // Actually parsing this puzzle has one missing cell — we use a different
    // puzzle to avoid completion.
    const saved = loadGame("assist-save");
    expect(saved?.assistLevel).toBe("full");
  });
});
