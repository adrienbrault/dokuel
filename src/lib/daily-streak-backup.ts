import { type DailyStreak, getDailyStreak } from "./daily-streak.ts";
import { isCalendarDate } from "./date.ts";
import { writeJson } from "./storage.ts";

const STORAGE_KEY = "sudoku_daily_streak";
const LIFETIME_STORAGE_KEY = "sudoku_daily_streak_lifetime";
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_COMPLETED_DATES = 60;
const MAX_RANGES = 10000;

export type DailyStreakRange = { start: string; end: string };

export type DailyStreakBackup = {
  version: 1;
  streak: DailyStreak;
  lifetime: {
    version: 1;
    completedRanges: DailyStreakRange[];
  };
};

export function exportDailyStreak(): DailyStreakBackup {
  const streak = getDailyStreak();
  const lifetime = readLifetime(streak);
  return {
    version: 1,
    streak: cloneStreak(streak),
    lifetime: {
      version: 1,
      completedRanges: lifetime.completedRanges.map((range) => ({ ...range })),
    },
  };
}

export function validateDailyStreakBackup(
  value: unknown,
): DailyStreakBackup | null {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  if (!isRecord(parsed) || parsed.version !== 1) return null;
  const streak = validateStreak(parsed.streak);
  const lifetime = validateLifetime(parsed.lifetime);
  if (!streak || !lifetime) return null;
  return { version: 1, streak, lifetime };
}

export function importDailyStreak(value: unknown): boolean {
  const backup = validateDailyStreakBackup(value);
  if (!backup) return false;
  const previousStreak = readRaw(STORAGE_KEY);
  const previousLifetime = readRaw(LIFETIME_STORAGE_KEY);
  if (!writeJson(STORAGE_KEY, backup.streak)) return false;
  if (writeJson(LIFETIME_STORAGE_KEY, backup.lifetime)) return true;
  restoreRaw(STORAGE_KEY, previousStreak);
  restoreRaw(LIFETIME_STORAGE_KEY, previousLifetime);
  return false;
}

function readLifetime(streak: DailyStreak): DailyStreakBackup["lifetime"] {
  const parsed = readRaw(LIFETIME_STORAGE_KEY);
  const lifetime = parsed ? validateLifetime(parseJson(parsed)) : null;
  return lifetime ?? { version: 1, completedRanges: deriveRanges(streak) };
}

function deriveRanges(streak: DailyStreak): DailyStreakRange[] {
  const dates = streak.completedDates.filter(isCalendarDate);
  let ranges = buildRanges(dates);
  if (streak.currentStreak > 0 && isCalendarDate(streak.lastCompletedDate)) {
    const start = shiftDate(streak.lastCompletedDate, 1 - streak.currentStreak);
    if (start) {
      ranges = mergeRanges([
        ...ranges,
        { start, end: streak.lastCompletedDate },
      ]);
    }
  }
  return ranges;
}

function validateStreak(value: unknown): DailyStreak | null {
  if (!isRecord(value)) return null;
  const candidate = value as Partial<DailyStreak>;
  if (
    !isCount(candidate.currentStreak) ||
    !isCount(candidate.longestStreak) ||
    (candidate.lastCompletedDate !== "" &&
      !isCalendarDate(candidate.lastCompletedDate ?? "")) ||
    !Array.isArray(candidate.completedDates) ||
    candidate.completedDates.length > MAX_COMPLETED_DATES ||
    !candidate.completedDates.every(
      (date) => typeof date === "string" && isCalendarDate(date),
    )
  ) {
    return null;
  }
  return {
    currentStreak: candidate.currentStreak,
    lastCompletedDate: candidate.lastCompletedDate ?? "",
    longestStreak: candidate.longestStreak,
    completedDates: [...new Set(candidate.completedDates)],
  };
}

function validateLifetime(
  value: unknown,
): DailyStreakBackup["lifetime"] | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const ranges = value.completedRanges;
  if (!Array.isArray(ranges) || ranges.length > MAX_RANGES) return null;
  if (!ranges.every(isValidRange)) return null;
  for (let index = 1; index < ranges.length; index++) {
    const previous = ranges[index - 1];
    const current = ranges[index];
    if (
      !previous ||
      !current ||
      previous.end >= current.start ||
      isConsecutive(previous.end, current.start)
    ) {
      return null;
    }
  }
  return {
    version: 1,
    completedRanges: ranges.map((range) => ({ ...range })),
  };
}

function isValidRange(value: unknown): value is DailyStreakRange {
  if (!isRecord(value)) return false;
  const start = value.start;
  const end = value.end;
  return (
    typeof start === "string" &&
    typeof end === "string" &&
    isCalendarDate(start) &&
    isCalendarDate(end) &&
    start <= end
  );
}

function buildRanges(dates: string[]): DailyStreakRange[] {
  const ranges: DailyStreakRange[] = [];
  for (const date of [...new Set(dates)].sort()) {
    const previous = ranges.at(-1);
    if (previous && isConsecutive(previous.end, date)) {
      previous.end = date;
    } else {
      ranges.push({ start: date, end: date });
    }
  }
  return ranges;
}

function mergeRanges(ranges: DailyStreakRange[]): DailyStreakRange[] {
  return [...ranges]
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
    .reduce<DailyStreakRange[]>((merged, range) => {
      const previous = merged.at(-1);
      if (
        previous &&
        (previous.end >= range.start ||
          isConsecutive(previous.end, range.start))
      ) {
        if (range.end > previous.end) previous.end = range.end;
      } else {
        merged.push({ ...range });
      }
      return merged;
    }, []);
}

function isConsecutive(previous: string, next: string): boolean {
  const previousTime = dateTime(previous);
  const nextTime = dateTime(next);
  return (
    previousTime !== null &&
    nextTime !== null &&
    nextTime - previousTime === DAY_MS
  );
}

function dateTime(date: string): number | null {
  if (!isCalendarDate(date)) return null;
  return Date.parse(`${date}T00:00:00Z`);
}

function shiftDate(date: string, offset: number): string | null {
  const timestamp = dateTime(date);
  return timestamp === null
    ? null
    : new Date(timestamp + offset * DAY_MS).toISOString().slice(0, 10);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function cloneStreak(streak: DailyStreak): DailyStreak {
  return { ...streak, completedDates: [...streak.completedDates] };
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function restoreRaw(key: string, raw: string | null): void {
  try {
    if (raw === null) localStorage.removeItem(key);
    else localStorage.setItem(key, raw);
  } catch {
    // Best effort rollback; callers still receive a failed status.
  }
}

function parseJson(value: string | null): unknown {
  if (value === null) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
