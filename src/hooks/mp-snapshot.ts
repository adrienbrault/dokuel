import type { Player, RoomState } from "../lib/types.ts";

/**
 * Synchronous localStorage mirror of the room's Yjs state. y-indexeddb
 * is async and iOS Safari does not always give a backgrounded tab time
 * to flush pending IDB writes before it kills the process. We persist
 * the essentials here on pagehide / visibilitychange-hidden so that on
 * the next mount we can hydrate the Yjs doc even if IDB came back
 * stale or empty.
 *
 * Only fields the UI needs to render the in-progress game are mirrored
 * — opponent presence, GameEvents, and signaling state stay ephemeral.
 */

export type MpSnapshot = {
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
  savedAt: number;
};

const KEY_PREFIX = "dokuel_mp_snap_";

// Beyond this, a stored snapshot is stale enough that resuming it
// would likely conflict with whatever the room has become. The next
// peer sync would override it anyway, but we'd rather show a fresh
// lobby than briefly flash an outdated game.
const MAX_AGE_MS = 60 * 60 * 1000;

function key(roomId: string): string {
  return KEY_PREFIX + roomId;
}

export function saveSnapshot(roomId: string, state: RoomState): void {
  if (state.gameNumber === 0) return;
  const snap: MpSnapshot = {
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
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(key(roomId), JSON.stringify(snap));
  } catch {
    // Quota exceeded or storage unavailable — best-effort only.
  }
}

export function loadSnapshot(roomId: string): MpSnapshot | null {
  try {
    const raw = localStorage.getItem(key(roomId));
    if (!raw) return null;
    const snap = JSON.parse(raw) as MpSnapshot;
    if (
      typeof snap.gameNumber !== "number" ||
      typeof snap.savedAt !== "number" ||
      !Array.isArray(snap.players) ||
      Date.now() - snap.savedAt > MAX_AGE_MS
    ) {
      return null;
    }
    return snap;
  } catch {
    return null;
  }
}

export function clearSnapshot(roomId: string): void {
  try {
    localStorage.removeItem(key(roomId));
  } catch {
    // Ignore.
  }
}
