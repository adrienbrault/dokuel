import { formatShortTime } from "./format.ts";
import type { Challenge, Difficulty } from "./types.ts";

/** 23:59:59. Longer than any real solve; keeps the display sane. */
export const MAX_CHALLENGE_SECONDS = 24 * 60 * 60 - 1;

/** Room for "Adjective Animal" names plus a custom one, but not an essay. */
export const MAX_CHALLENGER_NAME_LENGTH = 24;

const FALLBACK_NAME = "A friend";

function cleanName(raw: string): string {
  const name = raw
    // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CHALLENGER_NAME_LENGTH)
    .trim();
  return name || FALLBACK_NAME;
}

/** Reads a challenge from a solo board URL's query string. */
export function parseChallenge(search: string): Challenge | null {
  const params = new URLSearchParams(search);
  const seconds = Math.floor(Number(params.get("t")));
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return {
    seconds: Math.min(seconds, MAX_CHALLENGE_SECONDS),
    name: cleanName(params.get("by") ?? ""),
    hinted: params.get("h") === "1",
  };
}

export type ChallengeComparison = {
  outcome: "won" | "lost" | "tie";
  headline: string;
  /** Who leaned on hints, if anyone; null for a clean head-to-head. */
  hintNote: string | null;
};

function describeHints(mine: boolean, challenge: Challenge): string | null {
  if (mine && challenge.hinted) return "Both of you used hints";
  if (mine) return "You used hints";
  if (challenge.hinted) return `${challenge.name} used hints`;
  return null;
}

/** The result screen's verdict on a finished challenge, player's side. */
export function compareToChallenge({
  seconds,
  hintsUsed,
  challenge,
}: {
  seconds: number;
  hintsUsed: number;
  challenge: Challenge;
}): ChallengeComparison {
  const margin = formatShortTime(Math.abs(seconds - challenge.seconds));
  const hintNote = describeHints(hintsUsed > 0, challenge);
  if (seconds < challenge.seconds) {
    return {
      outcome: "won",
      headline: `You beat ${challenge.name} by ${margin}`,
      hintNote,
    };
  }
  if (seconds > challenge.seconds) {
    return {
      outcome: "lost",
      headline: `${challenge.name} was ${margin} faster`,
      hintNote,
    };
  }
  return {
    outcome: "tie",
    headline: `Dead heat with ${challenge.name}`,
    hintNote,
  };
}

/**
 * The link a finisher sends: the same seeded solo board plus their
 * result, in readable params (?t=272&by=Swift+Fox, &h=1 with hints).
 */
export function buildChallengeUrl({
  origin,
  difficulty,
  gameKey,
  challenge,
}: {
  origin: string;
  difficulty: Difficulty;
  gameKey: string;
  challenge: Challenge;
}): string {
  const params = new URLSearchParams({
    t: String(challenge.seconds),
    by: challenge.name,
  });
  if (challenge.hinted) params.set("h", "1");
  return `${origin}/solo/${difficulty}/${encodeURIComponent(gameKey)}?${params}`;
}
