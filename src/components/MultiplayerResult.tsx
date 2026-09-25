import { type ComponentProps, useState } from "react";
import type { ReplayFrame } from "../lib/replay.ts";
import type { Player } from "../lib/types.ts";
import { MatchReplay, type ReplayPlayer } from "./MatchReplay.tsx";
import { MatchResult } from "./MatchResult.tsx";

type MultiplayerResultProps = Omit<
  ComponentProps<typeof MatchResult>,
  "onWatchReplay"
> & {
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
  replay,
  ...result
}: MultiplayerResultProps) {
  const [watching, setWatching] = useState(false);
  if (watching && replay) {
    return <MatchReplay {...replay} onClose={() => setWatching(false)} />;
  }
  return (
    <MatchResult
      {...result}
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

/** What the replay of the game that just ended needs. */
export function matchReplay(
  source: ReplaySource,
  game: {
    puzzle: string;
    solution: string | null;
    playerId: string;
    opponentName: string;
    gameOver: { winnerId: string };
  },
): NonNullable<MultiplayerResultProps["replay"]> {
  return {
    puzzle: game.puzzle,
    solution: game.solution,
    players: replayPlayers(
      source,
      game.playerId,
      game.opponentName,
      game.gameOver,
    ),
  };
}

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
