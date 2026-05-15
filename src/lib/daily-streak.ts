import { readJson, writeJson } from "./storage.ts";

export type DailyStreak = {
  currentStreak: number;
  lastCompletedDate: string;
  longestStreak: number;
};

const STORAGE_KEY = "sudoku_daily_streak";

function freshStreak(): DailyStreak {
  return { currentStreak: 0, lastCompletedDate: "", longestStreak: 0 };
}

export function getDailyStreak(): DailyStreak {
  return readJson<DailyStreak>(STORAGE_KEY, freshStreak());
}

/** Check if the given date string is exactly one day after the other. */
function isConsecutiveDay(prev: string, next: string): boolean {
  const prevDate = new Date(prev + "T00:00:00");
  const nextDate = new Date(next + "T00:00:00");
  const diffMs = nextDate.getTime() - prevDate.getTime();
  return diffMs === 24 * 60 * 60 * 1000;
}

export function recordDailyCompletion(date: string): DailyStreak {
  const streak = getDailyStreak();

  // No-op if already completed today
  if (streak.lastCompletedDate === date) return streak;

  if (
    streak.lastCompletedDate &&
    isConsecutiveDay(streak.lastCompletedDate, date)
  ) {
    streak.currentStreak++;
  } else {
    streak.currentStreak = 1;
  }

  streak.lastCompletedDate = date;
  streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);

  writeJson(STORAGE_KEY, streak);
  return streak;
}

export function isDailyCompleted(date: string): boolean {
  return getDailyStreak().lastCompletedDate === date;
}
