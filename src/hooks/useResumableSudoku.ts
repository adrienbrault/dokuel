import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteGame,
  loadGame,
  type SavedGame,
  saveGame,
} from "../lib/game-storage.ts";
import { saveGameResult } from "../lib/stats.ts";
import { generatePuzzle, solvePuzzle } from "../lib/sudoku.ts";
import type { AssistLevel, Cell, Difficulty } from "../lib/types.ts";
import { useSudoku } from "./useSudoku.ts";

type UseResumableSudokuOptions = {
  /** localStorage key for autosave. When omitted, no save/resume happens. */
  gameKey?: string;
  /** Pre-built puzzle to use when no saved game is present. */
  initialPuzzle?: string;
  /** Difficulty used to generate a new puzzle and to record stats. */
  difficulty: Difficulty;
  /** Assist level for a fresh game; overridden by saved.assistLevel when resuming. */
  initialAssistLevel: AssistLevel;
  /** Reads the current timer value. Called at save time and on completion. */
  getTimerSeconds: () => number;
  /** Called once when the board transitions to completed. */
  onComplete?: (timeSeconds: number) => void;
};

function boardToValues(board: { value: number | null }[][]): string {
  return board
    .flatMap((row) =>
      row.map((c) => (c.value === null ? "." : String(c.value))),
    )
    .join("");
}

function boardToNotes(board: { notes: Set<number> }[][]): number[][] {
  return board.flatMap((row) => row.map((c) => Array.from(c.notes)));
}

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
    const data: SavedGame = {
      puzzle,
      values: boardToValues(game.board as Cell[][]),
      notes: boardToNotes(game.board as Cell[][]),
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

  // On completion: clean up save, record stats, notify caller
  useEffect(() => {
    if (game.status !== "completed") return;
    const seconds = getTimerSeconds();
    if (gameKey) deleteGame(gameKey);
    saveGameResult(difficulty, seconds, true, game.hintsUsed);
    onComplete?.(seconds);
  }, [
    game.status,
    difficulty,
    gameKey,
    game.hintsUsed,
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
