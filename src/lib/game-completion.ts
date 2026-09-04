import { type DailyStreak, recordDailyCompletion } from "./daily-streak.ts";
import { deleteGame } from "./game-storage.ts";
import { trackProductEvent } from "./product-events.ts";
import { recordResult } from "./result-store.ts";
import type { GameOrigin } from "./result-store-types.ts";
import { getStatsForDifficulty } from "./stats.ts";
import type { AssistLevel, Difficulty } from "./types.ts";

export type GameCompletionContext = {
  /** Per-active-game autosave key; cleared on completion when present. */
  gameKey?: string | undefined;
  difficulty: Difficulty;
  /** Assist mode the game was completed under; recorded with the result. */
  assistLevel: AssistLevel;
  /** Final timer value in seconds. */
  timeSeconds: number;
  hintsUsed: number;
  /** ISO date (YYYY-MM-DD) of the daily challenge; signals daily flow. */
  dailyDate?: string | undefined;
  /** Where the puzzle came from; generated is the normal PB track. */
  origin?: GameOrigin | undefined;
  /** Stable identity of this attempt; repeated completion is ignored. */
  attemptId?: string | undefined;
  /** Stable identity of the puzzle, retained for history and comparison. */
  puzzleId?: string | undefined;
};

export type GameCompletionResult = {
  stats: ReturnType<typeof getStatsForDifficulty>;
  isNewPB: boolean;
  assistLevel: AssistLevel;
  timeSeconds: number;
  /** False when the durable result write failed; omitted on success for API compatibility. */
  persisted?: boolean;
  /** Streak after this completion. Present iff dailyDate was supplied. */
  streak?: DailyStreak;
};

/**
 * Records a finished Sudoku game's side effects in one place:
 * deletes the in-progress autosave, appends to per-difficulty stats,
 * and (for daily challenges) increments the streak. Single
 * integration point for any future completion-time effects
 * (achievements, share artifacts, sound, telemetry).
 */
export function completeGame(ctx: GameCompletionContext): GameCompletionResult {
  const origin = ctx.origin ?? (ctx.dailyDate ? "daily" : "generated");
  const attemptId = ctx.attemptId ?? ctx.gameKey;
  const priorBest =
    getStatsForDifficulty(ctx.difficulty, ctx.assistLevel, origin)?.bestTime ??
    null;
  const recorded = recordResult({
    difficulty: ctx.difficulty,
    assistLevel: ctx.assistLevel,
    time: ctx.timeSeconds,
    won: true,
    hintsUsed: ctx.hintsUsed,
    metadata: {
      origin,
      ...(attemptId === undefined ? {} : { attemptId }),
      ...(ctx.puzzleId === undefined ? {} : { puzzleId: ctx.puzzleId }),
      ...(ctx.dailyDate === undefined ? {} : { date: ctx.dailyDate }),
    },
  });
  const recordedOrigin = recorded.record.origin ?? origin;
  trackCompletionEvent(recorded, recordedOrigin);
  if (ctx.gameKey && recorded.persisted) {
    deleteGame(ctx.gameKey);
  }
  const result: GameCompletionResult = {
    stats: recorded.summary,
    isNewPB:
      !recorded.duplicate &&
      recordedOrigin === "generated" &&
      ctx.hintsUsed === 0 &&
      (priorBest === null || ctx.timeSeconds < priorBest),
    assistLevel: ctx.assistLevel,
    timeSeconds: Math.floor(recorded.record.time),
  };
  if (!recorded.persisted) result.persisted = false;
  if (ctx.dailyDate) result.streak = recordDailyCompletion(ctx.dailyDate);
  return result;
}

function trackCompletionEvent(
  recorded: ReturnType<typeof recordResult>,
  origin: GameOrigin,
): void {
  if (recorded.duplicate || !recorded.persisted) return;
  trackProductEvent("game_complete", productMode(origin), recorded.record.time);
}

function productMode(origin: GameOrigin): "solo" | "daily" | "friend" {
  if (origin === "daily") return "daily";
  if (origin === "friend") return "friend";
  return "solo";
}
