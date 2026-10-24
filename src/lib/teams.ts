import type { Player, Team } from "./types.ts";

/** A teams game needs exactly two players on each side. */
export function teamsReady(players: Player[]): boolean {
  const count = (team: Team) => players.filter((p) => p.team === team).length;
  return players.length === 4 && count("a") === 2 && count("b") === 2;
}
