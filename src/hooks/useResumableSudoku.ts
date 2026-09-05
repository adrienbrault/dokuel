import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { serializeBoard } from "../lib/board-engine.ts";
import type { FriendChallenge } from "../lib/challenge.ts";
import { hashCode, seededRandom } from "../lib/daily.ts";
import {
  completeGame,
  type GameCompletionResult,
} from "../lib/game-completion.ts";
import { loadGame, saveGame } from "../lib/game-storage.ts";
import type { GameOrigin } from "../lib/result-store-types.ts";
import { generatePuzzleWithSolution, solvePuzzle } from "../lib/sudoku.ts";
import type { AssistLevel, Cell, Difficulty } from "../lib/types.ts";
import { useFlushOnExit } from "./useFlushOnExit.ts";
import { useSudoku } from "./useSudoku.ts";

type UseResumableSudokuOptions = {
  challenge?: FriendChallenge | undefined;
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
  /** Explicit result category; inferred from dailyDate/challenge when absent. */
  origin?: GameOrigin | undefined;
  /** Stable attempt identity; defaults to gameKey when one exists. */
  attemptId?: string | undefined;
  /** Stable puzzle identity; defaults to the resolved puzzle string. */
  puzzleId?: string | undefined;
  /** Called once when the board transitions to completed. */
  onComplete?:
    | ((timeSeconds: number, result: GameCompletionResult) => void)
    | undefined;
};

export type SaveStatus = "idle" | "saved" | "failed";

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
  challenge,
  initialPuzzle,
  difficulty,
  initialAssistLevel,
  getTimerSeconds,
  dailyDate,
  origin,
  attemptId,
  puzzleId,
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
  const freshAttemptId = useMemo(
    () => createAttemptId(`${gameKey ?? ""}:${puzzle}`),
    [gameKey, puzzle],
  );
  const inferredOrigin: GameOrigin = dailyDate
    ? "daily"
    : challenge
      ? "friend"
      : initialPuzzle
        ? "imported"
        : "generated";
  const resultOrigin = saved?.origin ?? origin ?? inferredOrigin;
  const resultAttemptId = saved?.attemptId ?? attemptId ?? freshAttemptId;
  const resultPuzzleId = saved?.puzzleId ?? puzzleId ?? puzzle;

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

  const [assistance, setAssistance] = useState(() => ({
    current: saved?.assistLevel ?? initialAssistLevel,
    max: saved?.maxAssistLevel ?? saved?.assistLevel ?? initialAssistLevel,
  }));
  const assistLevel = assistance.current;
  const maxAssistLevel = assistance.max;
  const setAssistLevel = useCallback((level: AssistLevel) => {
    const rank = { paper: 0, standard: 1, full: 2 };
    setAssistance((previous) => ({
      current: level,
      max: rank[level] > rank[previous.max] ? level : previous.max,
    }));
  }, []);

  // Callers pass inline closures (new identity per render); read via a
  // ref so the save effect keys on game state, not render churn — with
  // the callback in the deps, a digit drag re-rendered SoloGame per
  // pointermove and wrote localStorage up to ~60 times a second.
  const getTimerSecondsRef = useRef(getTimerSeconds);
  getTimerSecondsRef.current = getTimerSeconds;
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Auto-save on every board / hint / assist-level change while playing
  const persist = useCallback(() => {
    if (!gameKey || game.status === "completed") return;
    const { values, notes } = serializeBoard(game.board as Cell[][]);
    const persisted = saveGame(gameKey, {
      puzzle,
      values,
      notes,
      timer: getTimerSecondsRef.current(),
      difficulty,
      assistLevel,
      maxAssistLevel,
      challenge,
      hintsUsed: game.hintsUsed,
      origin: resultOrigin,
      ...(resultAttemptId === undefined ? {} : { attemptId: resultAttemptId }),
      ...(resultPuzzleId === undefined ? {} : { puzzleId: resultPuzzleId }),
    });
    setSaveStatus(persisted ? "saved" : "failed");
  }, [
    game.board,
    game.status,
    game.hintsUsed,
    gameKey,
    puzzle,
    difficulty,
    assistLevel,
    maxAssistLevel,
    challenge,
    resultOrigin,
    resultAttemptId,
    resultPuzzleId,
  ]);

  useEffect(persist, [persist]);
  useFlushOnExit(persist);

  // On completion: orchestrate side effects via completeGame, notify caller.
  // Guarded so dep churn (getTimerSeconds is recreated every render) can't
  // re-fire completeGame and log the same win multiple times.
  const [completion, setCompletion] = useState<GameCompletionResult | null>(
    null,
  );
  const completedRef = useRef(false);
  const complete = useCallback(() => {
    const result = completeGame({
      gameKey,
      difficulty,
      assistLevel: maxAssistLevel,
      timeSeconds: getTimerSecondsRef.current(),
      hintsUsed: game.hintsUsed,
      dailyDate,
      origin: resultOrigin,
      attemptId: resultAttemptId,
      puzzleId: resultPuzzleId,
    });
    setCompletion(result);
    onComplete?.(result.timeSeconds, result);
    return result;
  }, [
    game.hintsUsed,
    gameKey,
    difficulty,
    maxAssistLevel,
    dailyDate,
    resultOrigin,
    resultAttemptId,
    resultPuzzleId,
    onComplete,
  ]);

  useEffect(() => {
    if (game.status !== "completed") {
      completedRef.current = false;
      return;
    }
    if (completedRef.current) return;
    completedRef.current = true;
    complete();
  }, [game.status, complete]);

  const retrySave = useCallback(() => {
    persist();
  }, [persist]);
  const retryCompletion = useCallback(() => {
    if (game.status !== "completed" || completion?.persisted !== false) return;
    complete();
  }, [game.status, completion?.persisted, complete]);

  return {
    game,
    puzzle,
    completion,
    initialTimerSeconds: saved?.timer ?? 0,
    assistLevel,
    setAssistLevel,
    maxAssistLevel,
    saveStatus,
    retrySave,
    retryCompletion,
  };
}

function createAttemptId(seed: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `attempt-${seed.length}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
