/**
 * "Beat my time" challenges: a solo link that carries the sender's
 * finish time and name alongside the seeded board, so the receiver
 * plays the same puzzle and is scored against them.
 */
export type SoloChallenge = {
  /** The challenger's finish time, in whole seconds. */
  time: number;
  /** The challenger's display name. */
  by: string;
};

/** Names longer than this are treated as junk rather than truncated. */
export const MAX_CHALLENGER_NAME_LENGTH = 40;

// 1 to 999999 seconds: rejects zero, negatives, decimals, leading
// zeros, and absurd values that would only ever come from a mangled
// or hand-edited link.
const TIME_RE = /^[1-9]\d{0,5}$/;

/** Drops C0/C1 controls, which would otherwise reach the banner copy. */
function stripControlChars(value: string): string {
  return Array.from(value)
    .filter((ch) => ch >= " " && ch !== "\u007f")
    .join("");
}

/**
 * Reads a challenge out of a URL query string. Anything malformed
 * yields null: such a link still opens its board, just without the
 * challenge framing.
 */
export function parseChallenge(search: string): SoloChallenge | null {
  const params = new URLSearchParams(search);
  const rawTime = params.get("t");
  if (rawTime === null || !TIME_RE.test(rawTime)) return null;

  const by = stripControlChars(params.get("by") ?? "").trim();
  if (by === "" || by.length > MAX_CHALLENGER_NAME_LENGTH) return null;

  return { time: Number(rawTime), by };
}

/** The query string (including "?") that parseChallenge reads back. */
export function challengeQuery(challenge: SoloChallenge | undefined): string {
  if (!challenge) return "";
  return `?${new URLSearchParams({
    t: String(challenge.time),
    by: challenge.by,
  }).toString()}`;
}
