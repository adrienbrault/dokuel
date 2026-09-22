import { track } from "../lib/telemetry.ts";
import type { Connection } from "./mp-connection.ts";

/**
 * Connection-lifecycle telemetry for one open room, attached beside
 * the hook's own listeners rather than woven through them: it only
 * observes the {@link Connection} seam and never changes what the
 * connection does.
 */

export type ConnectionRole = "creator" | "joiner";

export const CONNECT_TIMEOUT_MS = 20_000;

export type ConnectionHealthOptions = {
  playerId: string;
  role: ConnectionRole;
  /** When the open started, on the same clock as `now`. */
  openedAt: number;
  now: () => number;
};

export function watchConnectionHealth(
  connection: Connection,
  { playerId, openedAt, now }: ConnectionHealthOptions,
): () => void {
  let peerSeen = false;

  const checkPeer = () => {
    if (peerSeen || !connection.hasOtherPeer(playerId)) return;
    peerSeen = true;
    track({ name: "mp_first_peer", ms: Math.round(now() - openedAt) });
  };

  const unsubscribe = connection.onPresenceChange(checkPeer);
  checkPeer();
  return unsubscribe;
}
