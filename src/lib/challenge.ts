import type { Challenge } from "./types.ts";

/** Reads a challenge from a solo board URL's query string. */
export function parseChallenge(search: string): Challenge | null {
  const params = new URLSearchParams(search);
  const seconds = Number(params.get("t"));
  const name = params.get("by") ?? "";
  return { seconds, name, hinted: false };
}
