import type { RoomState } from "../lib/types.ts";
import { roomDatabaseName } from "./mp-connection.ts";
import {
  decodeSnapshot,
  encodeSnapshot,
  type MpSnapshot,
} from "./mp-snapshot-codec.ts";

export type { MpSnapshot } from "./mp-snapshot-codec.ts";

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
  const snap = encodeSnapshot(state, Date.now());
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
    const snap = decodeSnapshot(raw);
    if (
      !snap ||
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

/**
 * Removes every snapshot key loadSnapshot would refuse (over-age or
 * malformed) and returns the room ids that were dropped. Without this,
 * each room ever visited parked a dead ~2KB entry in localStorage for
 * good — loadSnapshot ages entries out logically but never physically.
 */
export function sweepStaleSnapshots(): string[] {
  const swept: string[] = [];
  try {
    const staleKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (!storageKey?.startsWith(KEY_PREFIX)) continue;
      const roomId = storageKey.slice(KEY_PREFIX.length);
      if (loadSnapshot(roomId) === null) {
        staleKeys.push(storageKey);
        swept.push(roomId);
      }
    }
    for (const storageKey of staleKeys) {
      localStorage.removeItem(storageKey);
    }
  } catch {
    // Storage unavailable — nothing to sweep.
  }
  return swept;
}

/**
 * Best-effort deletion of the y-indexeddb databases behind rooms whose
 * snapshot just aged out — each holds the room's full Yjs update log
 * and otherwise accumulates per room forever. The database name comes
 * from the Connection, which is what created it. indexedDB.databases() is
 * not universal (and a DB open in another tab blocks deletion); both
 * cases fail silently and the next sweep retries.
 */
export function sweepStaleRoomDatabases(roomIds: string[]): void {
  if (roomIds.length === 0) return;
  try {
    for (const roomId of roomIds) {
      indexedDB.deleteDatabase(roomDatabaseName(roomId));
    }
  } catch {
    // IndexedDB unavailable — ignore.
  }
}
