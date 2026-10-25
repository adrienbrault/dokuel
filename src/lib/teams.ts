import type { Credit, Player, Team } from "./types.ts";

/** A teams game needs exactly two players on each side. */
export function teamsReady(players: Player[]): boolean {
  const count = (team: Team) => players.filter((p) => p.team === team).length;
  return players.length === 4 && count("a") === 2 && count("b") === 2;
}

/** "You 12 · Carol 9": each teammate's correct digits, in one line. */
export function formatCredits(credits: Credit[]): string {
  return credits.map((c) => `${c.name} ${c.count}`).join(" · ");
}
