import { useEffect, useMemo, useRef, useState } from "react";
import { serializeBoard } from "../lib/board-engine.ts";
import {
  completeGame,
  type GameCompletionResult,
} from "../lib/game-completion.ts";
import { loadGame, type SavedGame, saveGame } from "../lib/game-storage.ts";
import { generatePuzzleWithSolution, solvePuzzle } from "../lib/sudoku.ts";
import type { AssistLevel, Cell, Difficulty } from "../lib/types.ts";
import { useSudoku } from "./useSudoku.ts";

type UseResumableSudokuOptions = {
  /** localStorage key for autosave. When omitted, no save/resume happens. */
  gameKey?: string | undefined;
  /** Pre-built puzzle to use when no saved game is present. */
  initialPuzzle?: string | undefined;
  /** Difficulty used to generate a new puzzle and to record stats. */
  difficulty: Difficulty;
  /** Assist level for a fresh game; overridden by saved.assistLevel when resuming. */
  initialAssistLevel: AssistLevel;
  /** Reads the current timer value. Called at save time and on completion. */
  getTimerSeconds: () => number;
  /** ISO date (YYYY-MM-DD) — signals a daily challenge, drives streak. */
  dailyDate?: string | undefined;
  /** Called once when the board transitions to completed. */
  onComplete?:
    | ((timeSeconds: number, result: GameCompletionResult) => void)
    | undefined;
};

/**
 * A Sudoku game that persists its in-progress state to localStorage,
 * resumes from a previous session when a gameKey matches, deletes its
 * save on completion, and records the win in the per-difficulty stats.
 *
 * The timer is owned by the caller (the UI renders <Timer> on its own
 * schedule); the hook reads the current value via getTimerSeconds() at
 * save and completion time.
 */
export function useResumableSudoku({
  gameKey,
  initialPuzzle,
  difficulty,
  initialAssistLevel,
  getTimerSeconds,
  dailyDate,
  onComplete,
}: UseResumableSudokuOptions) {
  // Resolve puzzle + solution + save together: a saved or provided
  // puzzle that fails to solve is treated as corrupt and discarded
  // rather than crashing the render, falling back to a fresh puzzle.
  const resolved = useMemo(() => {
    const saved = gameKey ? loadGame(gameKey) : null;
    if (saved) {
      const solution = solvePuzzle(saved.puzzle);
      if (solution) return { saved, puzzle: saved.puzzle, solution };
    }
    if (initialPuzzle) {
      const solution = solvePuzzle(initialPuzzle);
      if (solution) return { saved: null, puzzle: initialPuzzle, solution };
    }
    return { saved: null, ...generatePuzzleWithSolution(difficulty) };
  }, [gameKey, initialPuzzle, difficulty]);
  const { saved, puzzle, solution } = resolved;

  const savedBoard = useMemo(
    () =>
      saved
        ? {
            values: saved.values,
            notes: saved.notes,
            hintsUsed: saved.hintsUsed,
          }
        : undefined,
    [saved],
  );

  const game = useSudoku(puzzle, solution, savedBoard);

  const [assistLevel, setAssistLevel] = useState<AssistLevel>(
    saved?.assistLevel ?? initialAssistLevel,
  );

  // Auto-save on every board / hint / assist-level change while playing
  useEffect(() => {
    if (!gameKey || game.status === "completed") return;
    const { values, notes } = serializeBoard(game.board as Cell[][]);
    const data: SavedGame = {
      puzzle,
      values,
      notes,
      timer: getTimerSeconds(),
      difficulty,
      assistLevel,
      hintsUsed: game.hintsUsed,
    };
    saveGame(gameKey, data);
  }, [
    game.board,
    game.status,
    game.hintsUsed,
    gameKey,
    puzzle,
    difficulty,
    assistLevel,
    getTimerSeconds,
  ]);

  // On completion: orchestrate side effects via completeGame, notify caller.
  // Guarded so dep churn (getTimerSeconds is recreated every render) can't
  // re-fire completeGame and log the same win multiple times.
  const completedRef = useRef(false);
  useEffect(() => {
    if (game.status !== "completed") {
      completedRef.current = false;
      return;
    }
    if (completedRef.current) return;
    completedRef.current = true;
    const seconds = getTimerSeconds();
    const result = completeGame({
      gameKey,
      difficulty,
      assistLevel,
      timeSeconds: seconds,
      hintsUsed: game.hintsUsed,
      dailyDate,
    });
    onComplete?.(seconds, result);
  }, [
    game.status,
    difficulty,
    assistLevel,
    gameKey,
    game.hintsUsed,
    dailyDate,
    getTimerSeconds,
    onComplete,
  ]);

  return {
    game,
    puzzle,
    initialTimerSeconds: saved?.timer ?? 0,
    assistLevel,
    setAssistLevel,
  };
}
