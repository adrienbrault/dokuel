import { useEffect, useMemo, useRef, useState } from "react";
import { serializeBoard } from "../lib/board-engine.ts";
import { hashCode, seededRandom } from "../lib/daily.ts";
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
  /** The daily is an archive replay: recorded, but never a streak day. */
  dailyArchive?: boolean | undefined;
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
  dailyArchive,
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
    // Seed generation from the gameKey: /solo/<difficulty>/<key> then
    // identifies its board, so a shared or bookmarked solo URL
    // reproduces the same puzzle on any device (same mechanism as the
    // daily challenge).
    const rng = gameKey
      ? seededRandom(hashCode(`sudoku-solo-${gameKey}`))
      : undefined;
    return { saved: null, ...generatePuzzleWithSolution(difficulty, rng) };
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

  // Callers pass inline closures (new identity per render); read via a
  // ref so the save effect keys on game state, not render churn — with
  // the callback in the deps, a digit drag re-rendered SoloGame per
  // pointermove and wrote localStorage up to ~60 times a second.
  const getTimerSecondsRef = useRef(getTimerSeconds);
  getTimerSecondsRef.current = getTimerSeconds;

  // Auto-save on every board / hint / assist-level change while playing
  useEffect(() => {
    if (!gameKey || game.status === "completed") return;
    const { values, notes } = serializeBoard(game.board as Cell[][]);
    const data: SavedGame = {
      puzzle,
      values,
      notes,
      timer: getTimerSecondsRef.current(),
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
  ]);

  // Flush on pagehide/tab-hide: the effect above only fires on state
  // changes, so idle thinking time between moves would otherwise be
  // lost on refresh and the resumed timer would rewind.
  useEffect(() => {
    if (!gameKey) return;
    const flush = () => {
      if (game.status === "completed") return;
      const { values, notes } = serializeBoard(game.board as Cell[][]);
      saveGame(gameKey, {
        puzzle,
        values,
        notes,
        timer: getTimerSecondsRef.current(),
        difficulty,
        assistLevel,
        hintsUsed: game.hintsUsed,
      });
    };
    const onVisibility = () => {
      if (document.hidden) flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [
    game.board,
    game.status,
    game.hintsUsed,
    gameKey,
    puzzle,
    difficulty,
    assistLevel,
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
      archive: dailyArchive,
    });
    onComplete?.(seconds, result);
  }, [
    game.status,
    difficulty,
    assistLevel,
    gameKey,
    game.hintsUsed,
    dailyDate,
    dailyArchive,
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
