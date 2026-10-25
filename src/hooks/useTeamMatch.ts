import { useMemo } from "react";
import type { OpponentBar } from "../components/MultiplayerHeaderExtra.tsx";
import { formatNameList } from "../lib/format.ts";
import type { Player, RoomState, TeamCells } from "../lib/types.ts";
import type { TeamPlay } from "./useTeamBoardSync.ts";

type GameOver = { winnerId: string; winnerName: string };

const NO_IDS: string[] = [];

/**
 * How the room looks from our seat: in a teams game the race is our
 * team against theirs, so the other team collapses into one bar and
 * one name, and a game is won or lost by a team. Outside one, every
 * other player is a rival of their own.
 */
export function useTeamMatch({
  room,
  playerId,
  gameOver,
  cells,
  setCell,
  contributions,
}: {
  /** The last known room state, so a sync blip keeps the teams. */
  room: RoomState | null;
  playerId: string;
  gameOver: GameOver | null;
  cells: TeamCells | null;
  setCell: (index: number, value: number | null) => void;
  /** Correct digits per player on our shared board, from the room. */
  contributions: Readonly<Record<string, number>> | null;
}) {
  const players = room?.players ?? [];
  const ours = players.find((p) => p.id === playerId)?.team ?? null;
  const teams = room?.mode === "teams" && ours !== null;
  const coop = room?.mode === "coop";
  const others = players.filter((p) => p.id !== playerId);
  const allyPlayers = coop
    ? others
    : teams
      ? others.filter((p) => p.team === ours)
      : [];
  const rivals = coop
    ? []
    : teams
      ? others.filter((p) => p.team !== ours)
      : others;
  const allyKey = allyPlayers.map((p) => p.id).join(",");
  const allies = useMemo(
    () => (allyKey ? allyKey.split(",") : NO_IDS),
    [allyKey],
  );
  const shared = teams || coop;
  const credits = shared
    ? [
        { name: "You", count: contributions?.[playerId] ?? 0 },
        ...allyPlayers.map((p) => ({
          name: p.name,
          count: contributions?.[p.id] ?? 0,
        })),
      ]
    : undefined;
  // Keyed by content: the counts arrive as a fresh object on every
  // room change, and a new TeamPlay each time would re-render the board.
  const creditKey = JSON.stringify(credits);
  const team: TeamPlay | undefined = useMemo(
    () =>
      shared
        ? {
            cells,
            setCell,
            allies,
            coop,
            credits: creditKey ? JSON.parse(creditKey) : undefined,
          }
        : undefined,
    [shared, cells, setCell, allies, coop, creditKey],
  );

  // A replay sets us against one other board; a teammate's is ours.
  const roomPlayers = room?.players;
  const replayPlayers = useMemo(
    () => (roomPlayers ?? []).filter((p) => !allies.includes(p.id)),
    [roomPlayers, allies],
  );

  const rivalName = formatNameList(rivals.map((p) => p.name));
  const bars: OpponentBar[] = coop
    ? []
    : teams
      ? [
          {
            id: "rivals",
            name: rivalName,
            color: rivals[0]?.color ?? "",
            completionPercent: Math.max(
              0,
              ...rivals.map((p) => p.completionPercent),
            ),
            named: true,
          },
        ]
      : others;

  return {
    bars,
    rivalName,
    replayPlayers,
    team,
    gameOver: teams && gameOver ? teamGameOver(gameOver, players) : gameOver,
  };
}

/** A team wins together: the winner's name becomes the whole team's. */
function teamGameOver(gameOver: GameOver, players: Player[]): GameOver {
  const winner = players.find((p) => p.id === gameOver.winnerId);
  if (!winner?.team) return gameOver;
  const names = players
    .filter((p) => p.team === winner.team)
    .map((p) => p.name);
  return { ...gameOver, winnerName: formatNameList(names) };
}
