import type { Player, RoomState } from "../lib/types.ts";

/** The first explicit schema version for durable multiplayer recovery. */
export const MP_SNAPSHOT_VERSION = 2 as const;

export type MpSnapshot = {
  version: typeof MP_SNAPSHOT_VERSION;
  gameNumber: number;
  puzzle: string | null;
  solution: string | null;
  status: RoomState["status"];
  difficulty: RoomState["difficulty"];
  assistLevel: RoomState["assistLevel"];
  hostId: string;
  players: Player[];
  winnerId: string | null;
  winnerName: string | null;
  winnerBoard: string | null;
  rematchReady: string[];
  savedAt: number;
};

export function encodeSnapshot(state: RoomState, savedAt: number): MpSnapshot {
  return {
    version: MP_SNAPSHOT_VERSION,
    gameNumber: state.gameNumber,
    puzzle: state.puzzle,
    solution: state.solution,
    status: state.status,
    difficulty: state.difficulty,
    assistLevel: state.assistLevel,
    hostId: state.hostId,
    players: state.players,
    winnerId: state.winnerId,
    winnerName: state.winnerName,
    winnerBoard: state.winnerBoard,
    rematchReady: [...(state.rematchReady ?? [])],
    savedAt,
  };
}

function isPlayer(value: unknown): value is Player {
  if (typeof value !== "object" || value === null) return false;
  const player = value as Record<string, unknown>;
  return (
    typeof player.id === "string" &&
    player.id.length > 0 &&
    typeof player.name === "string" &&
    typeof player.color === "string" &&
    Number.isInteger(player.cellsRemaining) &&
    player.cellsRemaining >= 0 &&
    player.cellsRemaining <= 81 &&
    typeof player.completionPercent === "number" &&
    Number.isFinite(player.completionPercent) &&
    player.completionPercent >= 0 &&
    player.completionPercent <= 100
  );
}

function hasValidPlayers(value: unknown): value is Player[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 2) {
    return false;
  }
  const ids = new Set<string>();
  return value.every((player) => {
    if (!isPlayer(player) || ids.has(player.id)) return false;
    ids.add(player.id);
    return true;
  });
}

export function decodeSnapshot(raw: string): MpSnapshot | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const version = record.version;
    if (version !== undefined && version !== 1 && version !== 2) return null;
    const normalized = {
      ...record,
      version: MP_SNAPSHOT_VERSION,
      winnerBoard: record.winnerBoard ?? null,
      rematchReady: Array.isArray(record.rematchReady)
        ? record.rematchReady
        : [],
    };
    return hasValidPlayers(normalized.players)
      ? (normalized as MpSnapshot)
      : null;
  } catch {
    return null;
  }
}
