import { readJson, writeJson } from "./storage.ts";

export type DailyStreak = {
  currentStreak: number;
  lastCompletedDate: string;
  longestStreak: number;
};

const STORAGE_KEY = "sudoku_daily_streak";

const DEFAULT_STREAK: DailyStreak = {
  currentStreak: 0,
  lastCompletedDate: "",
  longestStreak: 0,
};

export function getDailyStreak(): DailyStreak {
  return readJson<DailyStreak>(STORAGE_KEY, { ...DEFAULT_STREAK }, (parsed) => {
    // JSON.parse happily returns null/numbers/objects of the wrong
    // shape; recordDailyCompletion does arithmetic on these fields.
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as DailyStreak).currentStreak !== "number" ||
      typeof (parsed as DailyStreak).longestStreak !== "number" ||
      typeof (parsed as DailyStreak).lastCompletedDate !== "string"
    ) {
      return null;
    }
    return parsed as DailyStreak;
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Check if the given date string is exactly one calendar day after the
 * other. Compares in UTC so local DST transitions (23h/25h days) can't
 * break the comparison.
 */
function isConsecutiveDay(prev: string, next: string): boolean {
  const prevUtc = parseDateUTC(prev);
  const nextUtc = parseDateUTC(next);
  if (prevUtc === null || nextUtc === null) return false;
  return nextUtc - prevUtc === DAY_MS;
}

function parseDateUTC(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
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
