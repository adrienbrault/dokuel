import type { Player } from "./types.ts";

/**
 * The one opponent a two-board replay sets us against. In a 1v1 that
 * is simply the other player; in a bigger room it is the winner, or,
 * when we won, whoever got closest.
 */
export function pickReplayOpponent(
  players: Player[],
  playerId: string,
  winnerId: string,
): Player | undefined {
  const others = players.filter((p) => p.id !== playerId);
  return (
    others.find((p) => p.id === winnerId) ??
    others.reduce<Player | undefined>(
      (best, p) =>
        !best || p.completionPercent > best.completionPercent ? p : best,
      undefined,
    )
  );
}
