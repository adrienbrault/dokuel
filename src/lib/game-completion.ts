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
};

export type GameCompletionResult = {
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
    return { streak: recordDailyCompletion(ctx.dailyDate) };
  }
  return {};
}
