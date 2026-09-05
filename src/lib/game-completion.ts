import { recordDailyResult } from "./daily-results.ts";
import { type DailyStreak, recordDailyCompletion } from "./daily-streak.ts";
import { deleteGame } from "./game-storage.ts";
import { saveGameResult } from "./stats.ts";
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
  /**
   * The daily was replayed from the archive rather than opened as the
   * day's puzzle. Decided when the game opens, not when it is won: a
   * daily started at 23:55 and solved at 00:05 is still that day's.
   */
  archive?: boolean | undefined;
};

export type GameCompletionResult = {
  /** Streak after this completion. Present only for a non-archive daily. */
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
  if (ctx.gameKey) {
    deleteGame(ctx.gameKey);
  }
  saveGameResult(
    ctx.difficulty,
    ctx.assistLevel,
    ctx.timeSeconds,
    true,
    ctx.hintsUsed,
  );
  if (ctx.dailyDate) {
    recordDailyResult(ctx.dailyDate, ctx.timeSeconds);
    // Only the day's daily is a day of the streak. Archive dailies earn
    // their record and their checkmark, but an afternoon spent
    // catching up on old dates must not mint a run nobody played.
    if (!ctx.archive) {
      return { streak: recordDailyCompletion(ctx.dailyDate) };
    }
  }
  return {};
}
