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
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { ...DEFAULT_STREAK };
  } catch {
    return { ...DEFAULT_STREAK };
  }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Days since the epoch for a YYYY-MM-DD string, counted in UTC.
 *
 * Anchoring to UTC keeps every calendar day exactly 24 hours long.
 * Parsing these dates in local time instead makes the spring-forward
 * day 23 hours and the fall-back day 25, so a day-to-day comparison
 * would disagree with the calendar twice a year.
 */
function toDayNumber(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1) / MS_PER_DAY;
}

/** Check if the given date string is exactly one calendar day after the other. */
function isConsecutiveDay(prev: string, next: string): boolean {
  return toDayNumber(next) - toDayNumber(prev) === 1;
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

  localStorage.setItem(STORAGE_KEY, JSON.stringify(streak));
  return streak;
}

export function isDailyCompleted(date: string): boolean {
  return getDailyStreak().lastCompletedDate === date;
}
