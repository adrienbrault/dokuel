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
