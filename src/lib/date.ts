/**
 * The local calendar date as YYYY-MM-DD. This — never toISOString(),
 * which reports the UTC date — is the app's notion of "today": the
 * daily puzzle rolls over at the player's local midnight and streak
 * bookkeeping uses the same string.
 */
export function todayLocalISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** One calendar day, for arithmetic on UTC-midnight timestamps. */
export const DAY_MS = 24 * 60 * 60 * 1000;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * UTC midnight for a YYYY-MM-DD string, or null when it is not a real
 * day. UTC on purpose: the strings are calendar dates, and local DST
 * transitions (23h and 25h days) would otherwise break "one day apart".
 * Date.UTC happily rolls 2026-02-31 into March, so the result has to
 * round-trip to count.
 */
export function parseDateUTC(date: string): number | null {
  const match = ISO_DATE.exec(date);
  if (!match) return null;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return toISODateUTC(ms) === date ? ms : null;
}

/** The YYYY-MM-DD of a UTC timestamp; the inverse of parseDateUTC. */
export function toISODateUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
