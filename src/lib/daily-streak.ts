import { readJson, writeJson } from "./storage.ts";

export type DailyStreak = {
  currentStreak: number;
  lastCompletedDate: string;
  longestStreak: number;
  // Recent completion days (bounded). The source of truth for streak
  // math: a set of days is order-insensitive, so completing yesterday's
  // daily after today's (timezone travel, corrected clocks) neither
  // resets nor double-counts.
  completedDates: string[];
};

const STORAGE_KEY = "sudoku_daily_streak";

// Enough to cover any currentStreak we can display plus slack; the
// longest-ever streak is kept as a scalar so trimming can't lose it.
const MAX_COMPLETED_DATES = 60;

const DEFAULT_STREAK: DailyStreak = {
  currentStreak: 0,
  lastCompletedDate: "",
  longestStreak: 0,
  completedDates: [],
};

export function getDailyStreak(): DailyStreak {
  return readJson<DailyStreak>(
    STORAGE_KEY,
    { ...DEFAULT_STREAK, completedDates: [] },
    (parsed) => {
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
      const streak = parsed as DailyStreak;
      // Migrate records written before completedDates existed.
      const dates = Array.isArray(streak.completedDates)
        ? streak.completedDates.filter((d) => typeof d === "string")
        : streak.lastCompletedDate
          ? [streak.lastCompletedDate]
          : [];
      return { ...streak, completedDates: dates };
    },
  );
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

  if (streak.completedDates.includes(date)) return streak;
  if (parseDateUTC(date) === null) return streak;

  // Newest-first, deduped, bounded — then derive the streak by walking
  // the consecutive run from the most recent completed day.
  const dates = [...streak.completedDates, date]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, MAX_COMPLETED_DATES);

  let run = 1;
  while (run < dates.length && isConsecutiveDay(dates[run]!, dates[run - 1]!)) {
    run++;
  }

  const next: DailyStreak = {
    currentStreak: run,
    lastCompletedDate: dates[0]!,
    longestStreak: Math.max(streak.longestStreak, run),
    completedDates: dates,
  };
  writeJson(STORAGE_KEY, next);
  return next;
}

export function isDailyCompleted(date: string): boolean {
  return getDailyStreak().completedDates.includes(date);
}
