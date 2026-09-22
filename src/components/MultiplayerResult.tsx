import { useState } from "react";
import type { ReplayFrame } from "../lib/replay.ts";
import type { Difficulty, Player } from "../lib/types.ts";
import { GameResult } from "./GameResult.tsx";
import { MatchReplay, type ReplayPlayer } from "./MatchReplay.tsx";

type MultiplayerResultProps = {
  isWinner: boolean;
  time: string;
  difficulty: Difficulty;
  onNewGame: () => void;
  onRematch: () => void;
  /** What the replay needs; omitted, the modal offers no replay. */
  replay?:
    | {
        puzzle: string;
        solution: string | null;
        players: [ReplayPlayer, ReplayPlayer];
      }
    | undefined;
};

/** The end of a match: the result modal, and the replay it leads to. */
export function MultiplayerResult({
  isWinner,
  time,
  difficulty,
  onNewGame,
  onRematch,
  replay,
}: MultiplayerResultProps) {
  const [watching, setWatching] = useState(false);
  if (watching && replay) {
    return <MatchReplay {...replay} onClose={() => setWatching(false)} />;
  }
  return (
    <GameResult
      isWinner={isWinner}
      time={time}
      difficulty={difficulty}
      isMultiplayer
      onNewGame={onNewGame}
      onRematch={onRematch}
      onWatchReplay={replay ? () => setWatching(true) : undefined}
    />
  );
}

const FALLBACK_COLORS = ["#3B82F6", "#EF4444"] as const;

/** What the room brings to a match replay. */
export type ReplaySource = {
  /** The room's seated players, for names and colors. */
  players: Player[];
  /** Replays of the game that just ended, by player id. */
  replays: Readonly<Record<string, ReplayFrame[]>>;
  /** Hands our recording to the room; called only once the game is over. */
  share: (frames: ReplayFrame[]) => void;
};

/** Us on the left of the compare divider, the opponent on the right. */
export function replayPlayers(
  { players, replays }: ReplaySource,
  playerId: string,
  opponentName: string,
  gameOver: { winnerId: string },
): [ReplayPlayer, ReplayPlayer] {
  const me = players.find((p) => p.id === playerId);
  const opponent = players.find((p) => p.id !== playerId);
  const opponentId = opponent?.id ?? "";
  return [
    {
      id: playerId,
      name: "You",
      color: me?.color ?? FALLBACK_COLORS[0],
      won: gameOver.winnerId === playerId,
      frames: replays[playerId] ?? null,
    },
    {
      id: opponentId,
      name: opponent?.name ?? (opponentName || "Opponent"),
      color: opponent?.color ?? FALLBACK_COLORS[1],
      won: gameOver.winnerId === opponentId,
      frames: replays[opponentId] ?? null,
    },
  ];
}
