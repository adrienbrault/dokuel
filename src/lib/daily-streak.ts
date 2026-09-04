import { readJson, writeJson } from "./storage.ts";

export type DailyStreak = {
  currentStreak: number;
  lastCompletedDate: string;
  longestStreak: number;
  // Recent completion days, kept small for the daily screen. Lifetime
  // continuity lives in the interval store below.
  completedDates: string[];
};

const STORAGE_KEY = "sudoku_daily_streak";
const LIFETIME_STORAGE_KEY = "sudoku_daily_streak_lifetime";
const MAX_COMPLETED_DATES = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

type DayRange = { start: string; end: string };
type LifetimeStreak = { version: 1; completedRanges: DayRange[] };

const DEFAULT_STREAK: DailyStreak = {
  currentStreak: 0,
  lastCompletedDate: "",
  longestStreak: 0,
  completedDates: [],
};

export function getDailyStreak(): DailyStreak {
  const primary = readPrimaryStreak();
  return project(readLifetimeStreak(primary), primary);
}

function readPrimaryStreak(): DailyStreak {
  return readJson<DailyStreak>(
    STORAGE_KEY,
    { ...DEFAULT_STREAK, completedDates: [] },
    (parsed) => {
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
      const dates = Array.isArray(streak.completedDates)
        ? streak.completedDates.filter((date) => typeof date === "string")
        : streak.lastCompletedDate
          ? [streak.lastCompletedDate]
          : [];
      return { ...streak, completedDates: dates };
    },
  );
}

/** Compare calendar dates in UTC so local DST changes cannot break a run. */
function isConsecutiveDay(previous: string, next: string): boolean {
  const previousUtc = parseDateUTC(previous);
  const nextUtc = parseDateUTC(next);
  return (
    previousUtc !== null && nextUtc !== null && nextUtc - previousUtc === DAY_MS
  );
}

function parseDateUTC(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const normalized = new Date(timestamp);
  return normalized.getUTCFullYear() === year &&
    normalized.getUTCMonth() === month - 1 &&
    normalized.getUTCDate() === day
    ? timestamp
    : null;
}

export function recordDailyCompletion(date: string): DailyStreak {
  const primary = readPrimaryStreak();
  if (parseDateUTC(date) === null) return getDailyStreak();

  const lifetime = readLifetimeStreak(primary);
  if (lifetime.completedRanges.some((range) => isDateInRange(date, range))) {
    return project(lifetime, primary);
  }

  lifetime.completedRanges = addDateToRanges(lifetime.completedRanges, date);
  const current = lifetime.completedRanges.at(-1);
  if (!current) return project(lifetime, primary);
  const dates = recentDates(
    primary.completedDates.length > 0
      ? [...primary.completedDates, date]
      : recentDatesFromRanges(lifetime.completedRanges).concat(date),
  );
  const next: DailyStreak = {
    currentStreak: rangeLength(current),
    lastCompletedDate: current.end,
    longestStreak: Math.max(
      primary.longestStreak,
      ...lifetime.completedRanges.map(rangeLength),
    ),
    completedDates: dates,
  };
  writeJson(STORAGE_KEY, next);
  writeJson(LIFETIME_STORAGE_KEY, lifetime);
  return next;
}

export function isDailyCompleted(date: string): boolean {
  const primary = readPrimaryStreak();
  if (primary.completedDates.includes(date)) return true;
  return readLifetimeStreak(primary).completedRanges.some((range) =>
    isDateInRange(date, range),
  );
}

function readLifetimeStreak(primary: DailyStreak): LifetimeStreak {
  const raw = readJson<unknown>(
    LIFETIME_STORAGE_KEY,
    undefined,
    (value) => value,
  );
  return validateLifetimeStreak(raw) ?? migrateLifetime(primary);
}

function validateLifetimeStreak(value: unknown): LifetimeStreak | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<LifetimeStreak>;
  if (
    candidate.version !== 1 ||
    !Array.isArray(candidate.completedRanges) ||
    !candidate.completedRanges.every(isValidRange)
  ) {
    return null;
  }
  for (let index = 1; index < candidate.completedRanges.length; index++) {
    const previous = candidate.completedRanges[index - 1];
    const current = candidate.completedRanges[index];
    if (
      !previous ||
      !current ||
      previous.end >= current.start ||
      isConsecutiveDay(previous.end, current.start)
    ) {
      return null;
    }
  }
  return { version: 1, completedRanges: candidate.completedRanges };
}

function isValidRange(value: unknown): value is DayRange {
  if (typeof value !== "object" || value === null) return false;
  const range = value as Partial<DayRange>;
  const start = range.start;
  const end = range.end;
  const startUtc = typeof start === "string" ? parseDateUTC(start) : null;
  const endUtc = typeof end === "string" ? parseDateUTC(end) : null;
  return startUtc !== null && endUtc !== null && startUtc <= endUtc;
}

function migrateLifetime(primary: DailyStreak): LifetimeStreak {
  const lifetime: LifetimeStreak = {
    version: 1,
    completedRanges: buildRanges(primary.completedDates),
  };
  const current = lifetime.completedRanges.at(-1);
  if (
    current &&
    primary.currentStreak > rangeLength(current) &&
    current.end === primary.lastCompletedDate
  ) {
    const start = shiftDate(
      primary.lastCompletedDate,
      1 - primary.currentStreak,
    );
    if (start !== null) current.start = start;
  } else if (!current && primary.currentStreak > 0) {
    const start = shiftDate(
      primary.lastCompletedDate,
      1 - primary.currentStreak,
    );
    if (start !== null && parseDateUTC(primary.lastCompletedDate) !== null) {
      lifetime.completedRanges.push({
        start,
        end: primary.lastCompletedDate,
      });
    }
  }
  return lifetime;
}

function project(lifetime: LifetimeStreak, primary: DailyStreak): DailyStreak {
  const current = lifetime.completedRanges.at(-1);
  const dates =
    primary.completedDates.length > 0
      ? recentDates(primary.completedDates)
      : recentDatesFromRanges(lifetime.completedRanges);
  return {
    currentStreak: current ? rangeLength(current) : 0,
    lastCompletedDate: current?.end ?? "",
    longestStreak: Math.max(
      primary.longestStreak,
      ...lifetime.completedRanges.map(rangeLength),
    ),
    completedDates: dates,
  };
}

function buildRanges(dates: string[]): DayRange[] {
  const ranges: DayRange[] = [];
  for (const date of [...new Set(dates)]
    .filter((entry) => parseDateUTC(entry) !== null)
    .sort()) {
    const previous = ranges.at(-1);
    if (previous && isConsecutiveDay(previous.end, date)) {
      previous.end = date;
    } else {
      ranges.push({ start: date, end: date });
    }
  }
  return ranges;
}

function addDateToRanges(ranges: DayRange[], date: string): DayRange[] {
  const sorted = [...ranges, { start: date, end: date }].sort((a, b) =>
    a.start < b.start ? -1 : a.start > b.start ? 1 : 0,
  );
  const merged: DayRange[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (
      previous &&
      (isConsecutiveDay(previous.end, range.start) ||
        isDateInRange(range.start, previous))
    ) {
      if (range.end > previous.end) previous.end = range.end;
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function recentDates(dates: string[]): string[] {
  return [...new Set(dates)]
    .filter((date) => parseDateUTC(date) !== null)
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, MAX_COMPLETED_DATES);
}

function recentDatesFromRanges(ranges: DayRange[]): string[] {
  const dates: string[] = [];
  for (const range of [...ranges].reverse()) {
    let cursor = parseDateUTC(range.end);
    const start = parseDateUTC(range.start);
    if (cursor === null || start === null) continue;
    while (cursor >= start && dates.length < MAX_COMPLETED_DATES) {
      dates.push(new Date(cursor).toISOString().slice(0, 10));
      cursor -= DAY_MS;
    }
  }
  return recentDates(dates);
}

function isDateInRange(date: string, range: DayRange): boolean {
  const timestamp = parseDateUTC(date);
  const start = parseDateUTC(range.start);
  const end = parseDateUTC(range.end);
  return (
    timestamp !== null &&
    start !== null &&
    end !== null &&
    timestamp >= start &&
    timestamp <= end
  );
}

function rangeLength(range: DayRange): number {
  const start = parseDateUTC(range.start);
  const end = parseDateUTC(range.end);
  return start === null || end === null
    ? 0
    : Math.round((end - start) / DAY_MS) + 1;
}

function shiftDate(date: string, offset: number): string | null {
  const timestamp = parseDateUTC(date);
  return timestamp === null
    ? null
    : new Date(timestamp + offset * DAY_MS).toISOString().slice(0, 10);
}
