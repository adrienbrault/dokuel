import { track } from "../lib/telemetry.ts";
import type { Connection } from "./mp-connection.ts";

/**
 * Connection-lifecycle telemetry for one open room, attached beside
 * the hook's own listeners rather than woven through them: it only
 * observes the {@link Connection} seam and never changes what the
 * connection does.
 */

/**
 * "creator" came in from the create flow; "joiner" arrived by link or
 * by reloading a room URL. Only a joiner expects someone to be there.
 */
export type ConnectionRole = "creator" | "joiner";

/** How long after opening a room without a peer counts as failed. */
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
  { playerId, role, openedAt, now }: ConnectionHealthOptions,
): () => void {
  let peerSeen = false;
  const elapsed = () => Math.round(now() - openedAt);

  const checkPeer = () => {
    if (peerSeen || !connection.hasOtherPeer(playerId)) return;
    peerSeen = true;
    track({ name: "mp_first_peer", ms: elapsed() });
  };

  const checkTimeout = () => {
    // A backgrounded tab drops its own transport after a debounce, so
    // a miss while hidden says nothing about the network.
    if (peerSeen || document.hidden) return;
    if (!connection.connected) {
      track({
        name: "mp_connect_failed",
        reason: "signaling_timeout",
        role,
        ms: elapsed(),
      });
    } else if (role === "joiner") {
      track({
        name: "mp_connect_failed",
        reason: "peer_timeout",
        role,
        ms: elapsed(),
      });
    }
  };

  const unsubscribe = connection.onPresenceChange(checkPeer);
  const timer = setTimeout(checkTimeout, CONNECT_TIMEOUT_MS);
  checkPeer();
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}
