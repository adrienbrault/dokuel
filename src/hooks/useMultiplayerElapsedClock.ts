import {
  type MultiplayerGameIdentity,
  multiplayerGameKey,
  type SavedGame,
} from "../lib/game-storage.ts";
import { useElapsedClock } from "./useElapsedClock.ts";

type Options = {
  identity: MultiplayerGameIdentity;
  saved: SavedGame | null;
  running: boolean;
  /** Shared wall-clock instant at which the room's countdown ends. */
  startedAt?: number | null | undefined;
  /** Wall clock injection for deterministic tests. */
  now?: (() => number) | undefined;
};

/**
 * Multiplayer's duration policy: use the room's shared wall-clock anchor
 * when available so a reload or suspended tab includes the gap. Legacy
 * games fall back to their saved duration and begin counting on remount.
 */
export function useMultiplayerElapsedClock({
  identity,
  saved,
  running,
  startedAt,
  now,
}: Options) {
  const gameKey = multiplayerGameKey(identity);
  const hasSharedStart = typeof startedAt === "number";
  const elapsedClock = useElapsedClock({
    running,
    initialSeconds: hasSharedStart ? 0 : (saved?.timer ?? 0),
    resetKey: `${gameKey}:${startedAt ?? "legacy"}`,
    now: now ?? Date.now,
    startAt: hasSharedStart ? startedAt : null,
  });

  return { gameKey, saved, elapsedClock };
}
