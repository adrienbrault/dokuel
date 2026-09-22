import { useEffect } from "react";
import type { ReplayFrame } from "../lib/replay.ts";
import { saveArchivedReplay } from "../lib/replay-archive.ts";
import type { Player } from "../lib/types.ts";

type Options = {
  roomId: string;
  playerId: string;
  gameNumber: number;
  puzzle: string | null;
  solution: string | null;
  players: Player[];
  replays: Readonly<Record<string, ReplayFrame[]>>;
  gameOver: { winnerId: string } | null;
};

/**
 * Copies the room's replays of a finished match into the local archive,
 * so the Stats screen can replay it once the room is long gone. Runs
 * again whenever the replays move: the opponent's moves can land after
 * ours, and a loser who plays on keeps extending theirs.
 */
export function useArchiveMatchReplay({
  roomId,
  playerId,
  gameNumber,
  puzzle,
  solution,
  players,
  replays,
  gameOver,
}: Options) {
  useEffect(() => {
    const mine = replays[playerId];
    if (!gameOver || !puzzle || !mine) return;
    const me = players.find((p) => p.id === playerId);
    const opponent = players.find((p) => p.id !== playerId);
    const theirs = opponent ? replays[opponent.id] : undefined;
    saveArchivedReplay({
      roomId,
      gameNumber,
      puzzle,
      solution,
      me: {
        name: "You",
        color: me?.color ?? "#3B82F6",
        won: gameOver.winnerId === playerId,
        frames: mine,
      },
      opponent:
        opponent && theirs
          ? {
              name: opponent.name,
              color: opponent.color,
              won: gameOver.winnerId === opponent.id,
              frames: theirs,
            }
          : null,
    });
  }, [
    roomId,
    playerId,
    gameNumber,
    puzzle,
    solution,
    players,
    replays,
    gameOver,
  ]);
}
