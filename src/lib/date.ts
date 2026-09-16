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

/**
 * The instant a stored YYYY-MM-DD date began, in the reader's own
 * timezone — the inverse of todayLocalISO. Date.parse() would read the
 * same string as UTC midnight, which west of UTC lands on the previous
 * local afternoon and shuffles that day's games out of order.
 */
export function startOfLocalDay(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1).getTime();
}
