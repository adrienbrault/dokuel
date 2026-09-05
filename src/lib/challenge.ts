import { DIFFICULTY_LABELS } from "./constants.ts";
import { formatTime } from "./format.ts";
import type { Difficulty } from "./types.ts";

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

/** Where challenge links point. Absolute so the link survives a paste. */
const SITE_ORIGIN = "https://dokuel.com";

/**
 * The link a winner sends: the same seeded solo board, plus the time
 * to beat and who set it. The name is clamped rather than rejected -
 * a renamed player must not silently mint links that parse as no
 * challenge at all.
 */
export function buildChallengeUrl({
  difficulty,
  gameKey,
  timeSeconds,
  by,
}: {
  difficulty: Difficulty;
  gameKey: string;
  timeSeconds: number;
  by: string;
}): string {
  const challenge: SoloChallenge = {
    time: Math.max(1, Math.floor(timeSeconds)),
    by: by.trim().slice(0, MAX_CHALLENGER_NAME_LENGTH),
  };
  return `${SITE_ORIGIN}/solo/${difficulty}/${gameKey}${challengeQuery(challenge)}`;
}

/** The message that carries a challenge link into a chat thread. */
export function buildChallengeShareText({
  difficulty,
  time,
  url,
}: {
  difficulty: Difficulty;
  time: string;
  url: string;
}): string {
  return `I solved this ${DIFFICULTY_LABELS[difficulty]} sudoku in ${time}. Beat my time!\n${url}`;
}

export type ChallengeOutcome = {
  /** True only when the player finished strictly faster. */
  beaten: boolean;
  headline: string;
  /** The margin, or "" for a dead heat. */
  delta: string;
};

/**
 * How this finish reads against the challenge it answers. Kept out of
 * the dialog so the wording is pinned by tests rather than by markup.
 */
export function describeChallengeOutcome(
  challenge: SoloChallenge,
  timeSeconds: number,
): ChallengeOutcome {
  const theirs = formatTime(challenge.time);
  if (timeSeconds < challenge.time) {
    return {
      beaten: true,
      headline: `You beat ${challenge.by}'s ${theirs}!`,
      delta: `${formatTime(challenge.time - timeSeconds)} faster`,
    };
  }
  if (timeSeconds > challenge.time) {
    return {
      beaten: false,
      headline: `${challenge.by} was faster: ${theirs}`,
      delta: `${formatTime(timeSeconds - challenge.time)} behind`,
    };
  }
  return {
    beaten: false,
    headline: `Dead heat with ${challenge.by} at ${theirs}`,
    delta: "",
  };
}
