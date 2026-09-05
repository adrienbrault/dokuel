import { readJson, writeJson } from "./storage.ts";

/** One finished daily: how long it took, and when it was finished. */
export type DailyResult = {
  time: number;
  completedAt: number;
};

export type DailyResults = Record<string, DailyResult>;

const STORAGE_KEY = "sudoku_daily_results";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isResult(value: unknown): value is DailyResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as DailyResult;
  return (
    typeof result.time === "number" &&
    Number.isFinite(result.time) &&
    typeof result.completedAt === "number" &&
    Number.isFinite(result.completedAt)
  );
}

/**
 * Every daily this device has finished, keyed by ISO date. Separate
 * from the streak, which only tracks the consecutive-day run: an
 * archived daily belongs here without touching that run.
 */
export function getDailyResults(): DailyResults {
  return readJson<DailyResults>(STORAGE_KEY, {}, (parsed) => {
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    // Entry-level validation: the archive renders these times, so one
    // corrupt row must not take the whole listing down with it.
    const clean: DailyResults = {};
    for (const [date, value] of Object.entries(parsed)) {
      if (ISO_DATE.test(date) && isResult(value)) clean[date] = value;
    }
    return clean;
  });
}

export function getDailyResult(date: string): DailyResult | null {
  return getDailyResults()[date] ?? null;
}

/**
 * Records a finished daily. The first completion stands: the archive
 * reports when a date was solved, and a replay is not a new solve.
 */
export function recordDailyResult(
  date: string,
  time: number,
  now: number = Date.now(),
): DailyResults {
  const results = getDailyResults();
  if (!ISO_DATE.test(date) || results[date]) return results;

  const next: DailyResults = { ...results, [date]: { time, completedAt: now } };
  writeJson(STORAGE_KEY, next);
  return next;
}
