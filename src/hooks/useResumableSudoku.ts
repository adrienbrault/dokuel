import { useEffect, useMemo, useState } from "react";
import { serializeBoard } from "../lib/board-engine.ts";
import {
  completeGame,
  type GameCompletionResult,
} from "../lib/game-completion.ts";
import { loadGame, type SavedGame, saveGame } from "../lib/game-storage.ts";
import { generatePuzzle, solvePuzzle } from "../lib/sudoku.ts";
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
  const saved = useMemo(() => (gameKey ? loadGame(gameKey) : null), [gameKey]);

  const puzzle = useMemo(() => {
    if (saved?.puzzle) return saved.puzzle;
    if (initialPuzzle) return initialPuzzle;
    return generatePuzzle(difficulty);
  }, [difficulty, initialPuzzle, saved]);

  const solution = useMemo(() => solvePuzzle(puzzle), [puzzle]);

  const savedBoard = useMemo(
    () => (saved ? { values: saved.values, notes: saved.notes } : undefined),
    [saved],
  );

  const game = useSudoku(puzzle, solution, savedBoard);

  const [assistLevel, setAssistLevel] = useState<AssistLevel>(
    saved?.assistLevel ?? initialAssistLevel,
  );

  // Auto-save on every board / assist-level change while playing
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
    };
    saveGame(gameKey, data);
  }, [
    game.board,
    game.status,
    gameKey,
    puzzle,
    difficulty,
    assistLevel,
    getTimerSeconds,
  ]);

  // On completion: orchestrate side effects via completeGame, notify caller
  useEffect(() => {
    if (game.status !== "completed") return;
    const seconds = getTimerSeconds();
    const result = completeGame({
      gameKey,
      difficulty,
      timeSeconds: seconds,
      hintsUsed: game.hintsUsed,
      dailyDate,
    });
    onComplete?.(seconds, result);
  }, [
    game.status,
    difficulty,
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
