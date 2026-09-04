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
  const cellsRemaining = player.cellsRemaining;
  const completionPercent = player.completionPercent;
  return (
    typeof player.id === "string" &&
    player.id.length > 0 &&
    typeof player.name === "string" &&
    typeof player.color === "string" &&
    typeof cellsRemaining === "number" &&
    Number.isInteger(cellsRemaining) &&
    cellsRemaining >= 0 &&
    cellsRemaining <= 81 &&
    typeof completionPercent === "number" &&
    Number.isFinite(completionPercent) &&
    completionPercent >= 0 &&
    completionPercent <= 100
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

function isOneOf<T extends string>(
  value: unknown,
  values: readonly T[],
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function isPuzzle(value: unknown): value is string {
  return typeof value === "string" && /^[1-9.]{81}$/.test(value);
}

function isSolution(value: unknown): value is string {
  return typeof value === "string" && /^[1-9]{81}$/.test(value);
}

function givensMatchSolution(puzzle: string, solution: string): boolean {
  for (let index = 0; index < puzzle.length; index++) {
    if (puzzle[index] !== "." && puzzle[index] !== solution[index]) {
      return false;
    }
  }
  return true;
}

function isNullableName(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.length > 0);
}

function hasValidBoardFields(value: Record<string, unknown>): boolean {
  const puzzle = value.puzzle;
  const solution = value.solution;
  return (
    isPuzzle(puzzle) &&
    (solution === null || isSolution(solution)) &&
    (solution === null || givensMatchSolution(puzzle, solution))
  );
}

function hasValidWinnerFields(
  value: Record<string, unknown>,
  solution: unknown,
  playerIds: Set<string>,
): boolean {
  const winnerId = value.winnerId;
  const winnerName = value.winnerName;
  const winnerBoard = value.winnerBoard;
  return (
    isNullableName(winnerId) &&
    isNullableName(winnerName) &&
    (winnerId === null) === (winnerName === null) &&
    (winnerId === null || playerIds.has(winnerId)) &&
    (winnerBoard === null ||
      (isSolution(winnerBoard) &&
        solution !== null &&
        winnerBoard === solution))
  );
}

function hasValidRematchFields(
  value: Record<string, unknown>,
  playerIds: Set<string>,
): boolean {
  const rematchReady = value.rematchReady;
  if (
    !Array.isArray(rematchReady) ||
    !rematchReady.every(
      (id): id is string => typeof id === "string" && playerIds.has(id),
    ) ||
    new Set(rematchReady).size !== rematchReady.length
  ) {
    return false;
  }
  return true;
}

function hasValidRoomFields(
  value: Record<string, unknown>,
  playerIds: Set<string>,
): boolean {
  const gameNumber = value.gameNumber;
  const savedAt = value.savedAt;
  return (
    value.version === MP_SNAPSHOT_VERSION &&
    isOneOf(value.status, ["playing", "finished"] as const) &&
    isOneOf(value.difficulty, ["easy", "medium", "hard", "expert"] as const) &&
    isOneOf(value.assistLevel, ["paper", "standard", "full"] as const) &&
    typeof value.hostId === "string" &&
    value.hostId.length > 0 &&
    playerIds.has(value.hostId) &&
    typeof gameNumber === "number" &&
    Number.isSafeInteger(gameNumber) &&
    gameNumber > 0 &&
    typeof savedAt === "number" &&
    Number.isSafeInteger(savedAt) &&
    savedAt >= 0
  );
}

function hasValidStatusFields(value: Record<string, unknown>): boolean {
  const winnerId = value.winnerId;
  const winnerName = value.winnerName;
  const winnerBoard = value.winnerBoard;
  const rematchReady = value.rematchReady;
  return value.status === "finished"
    ? winnerId !== null && winnerName !== null
    : winnerId === null &&
        winnerName === null &&
        winnerBoard === null &&
        Array.isArray(rematchReady) &&
        rematchReady.length === 0;
}

function isValidSnapshot(value: Record<string, unknown>): boolean {
  const players = value.players;
  if (!hasValidPlayers(players)) return false;
  const playerIds = new Set(players.map((player) => player.id));

  return (
    hasValidBoardFields(value) &&
    hasValidWinnerFields(value, value.solution, playerIds) &&
    hasValidRematchFields(value, playerIds) &&
    hasValidRoomFields(value, playerIds) &&
    hasValidStatusFields(value)
  );
}

export function decodeSnapshot(raw: string): MpSnapshot | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const version = record.version;
    if (version !== undefined && version !== 1 && version !== 2) return null;
    const normalized: Record<string, unknown> = {
      ...record,
      version: MP_SNAPSHOT_VERSION,
      solution: record.solution ?? null,
      winnerId: record.winnerId ?? null,
      winnerName: record.winnerName ?? null,
      winnerBoard: record.winnerBoard ?? null,
      rematchReady:
        record.rematchReady === undefined ? [] : record.rematchReady,
    };
    return isValidSnapshot(normalized) ? (normalized as MpSnapshot) : null;
  } catch {
    return null;
  }
}
