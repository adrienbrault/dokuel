import { parseReplay, type ReplayFrame } from "./replay.ts";
import { readJson, writeJson } from "./storage.ts";

export type ArchivedPlayer = {
  name: string;
  color: string;
  won: boolean;
  frames: ReplayFrame[];
};

/**
 * One finished duel, kept so the Stats screen can replay it long after
 * the room is gone. Keyed like the match record, by room and game
 * number. The opponent is null until their client shares its moves.
 */
export type ArchivedReplay = {
  roomId: string;
  gameNumber: number;
  puzzle: string;
  solution: string | null;
  me: ArchivedPlayer;
  opponent: ArchivedPlayer | null;
};

const STORAGE_KEY = "sudoku_mp_replays";

/**
 * A replay runs to a few KB per player, against a few dozen bytes for a
 * result line, so the archive keeps the recent matches rather than the
 * full history.
 */
export const MAX_ARCHIVED_REPLAYS = 30;

function parsePlayer(raw: unknown): ArchivedPlayer | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { name, color, won, frames } = raw as Partial<ArchivedPlayer>;
  const parsed = parseReplay(frames);
  if (
    typeof name !== "string" ||
    typeof color !== "string" ||
    typeof won !== "boolean" ||
    !parsed
  ) {
    return null;
  }
  return { name, color, won, frames: parsed };
}

function parseArchived(raw: unknown): ArchivedReplay | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Partial<ArchivedReplay>;
  const me = parsePlayer(r.me);
  const opponent = r.opponent === null ? null : parsePlayer(r.opponent);
  if (
    typeof r.roomId !== "string" ||
    typeof r.gameNumber !== "number" ||
    typeof r.puzzle !== "string" ||
    !me ||
    (opponent === null && r.opponent !== null)
  ) {
    return null;
  }
  return {
    roomId: r.roomId,
    gameNumber: r.gameNumber,
    puzzle: r.puzzle,
    solution: typeof r.solution === "string" ? r.solution : null,
    me,
    opponent,
  };
}

function readAll(): unknown[] {
  return readJson<unknown[]>(STORAGE_KEY, [], (parsed) =>
    Array.isArray(parsed) ? parsed : null,
  );
}

function sameMatch(raw: unknown, roomId: string, gameNumber: number): boolean {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Partial<ArchivedReplay>;
  return r.roomId === roomId && r.gameNumber === gameNumber;
}

/** Store a match, replacing an earlier save of the same one in place. */
export function saveArchivedReplay(replay: ArchivedReplay): void {
  const all = readAll();
  const index = all.findIndex((r) =>
    sameMatch(r, replay.roomId, replay.gameNumber),
  );
  if (index !== -1) {
    const next = [...all];
    next[index] = replay;
    writeJson(STORAGE_KEY, next);
    return;
  }
  writeJson(STORAGE_KEY, [...all, replay].slice(-MAX_ARCHIVED_REPLAYS));
}

/** The stored replay of a match, or null when none survives intact. */
export function getArchivedReplay(
  roomId: string,
  gameNumber: number,
): ArchivedReplay | null {
  const raw = readAll().find((r) => sameMatch(r, roomId, gameNumber));
  return raw === undefined ? null : parseArchived(raw);
}

/** Every stored replay that survives intact, oldest first. */
export function getArchivedReplays(): ArchivedReplay[] {
  return readAll().flatMap((raw) => {
    const parsed = parseArchived(raw);
    return parsed ? [parsed] : [];
  });
}
