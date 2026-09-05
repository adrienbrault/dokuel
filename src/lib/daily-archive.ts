import { type DailyResult, getDailyResults } from "./daily-results.ts";
import { DAY_MS, parseDateUTC, todayLocalISO, toISODateUTC } from "./date.ts";

/**
 * The first daily anyone can play. It is also where the frozen board
 * table starts (see dailies.json): before this date the archive would
 * be serving boards the generator invents on the spot, which nobody
 * ever saw.
 */
export const FIRST_DAILY_DATE = "2026-05-01";

/**
 * Whether a date has a daily to play: a real calendar day, no earlier
 * than the first daily and no later than today. Anything else
 * canonicalizes back to today's daily.
 */
export function isPlayableDailyDate(
  date: string,
  today: string = todayLocalISO(),
): boolean {
  if (parseDateUTC(date) === null) return false;
  return date >= FIRST_DAILY_DATE && date <= today;
}

export type ArchiveEntry = {
  date: string;
  /** The stored result when this date was solved on this device. */
  result: DailyResult | null;
};

export type ArchiveMonth = {
  /** YYYY-MM; the caller decides how to label it. */
  month: string;
  entries: ArchiveEntry[];
};

/**
 * Recent dailies, newest first, grouped into the months they fall in.
 * The limit counts dates, not months, so the caller can page by
 * raising it without the page size drifting with month lengths.
 */
export function listDailyArchive({
  today = todayLocalISO(),
  limit = 60,
}: {
  today?: string;
  limit?: number;
} = {}): ArchiveMonth[] {
  const end = parseDateUTC(today);
  const first = parseDateUTC(FIRST_DAILY_DATE);
  if (end === null || first === null || end < first) return [];

  const results = getDailyResults();
  const months: ArchiveMonth[] = [];
  for (let ms = end, count = 0; ms >= first && count < limit; ms -= DAY_MS) {
    const date = toISODateUTC(ms);
    const month = date.slice(0, 7);
    if (months[months.length - 1]?.month !== month) {
      months.push({ month, entries: [] });
    }
    months[months.length - 1]?.entries.push({
      date,
      result: results[date] ?? null,
    });
    count++;
  }
  return months;
}
