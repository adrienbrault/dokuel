import type { Challenge } from "./types.ts";

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
    hinted: false,
  };
}
