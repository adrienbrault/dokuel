import type { Connection } from "./mp-connection.ts";
import type { Room } from "./mp-room.ts";

/**
 * What a backgrounded tab does to a room. Split out of
 * {@link ./useYjsMultiplayer.ts} because it is the one part of the
 * binding that is about the browser rather than about the room: it owns
 * the document listeners, the debounce timer, and the ordering between
 * releasing the transport and telling the Room we went away.
 *
 * iOS Safari kills backgrounded tabs under memory pressure and
 * RTCPeerConnections are the dominant cost, so the transport is
 * released after a short debounce - long enough that an app switch or
 * a notification glance does not cost a reconnect. The Y.Doc and local
 * persistence stay alive across the whole cycle.
 */

const HIDE_DEBOUNCE_MS = 15_000;

export type TabLifecycleOptions = {
  connection: Connection;
  room: Room;
  /** The binding's clock, so the Room measures every instant the same way. */
  now: () => number;
  /**
   * Re-publish who we are. `disconnect()` clears our own presence entry
   * (mirroring y-webrtc), so coming back has to announce again or the
   * opponent keeps seeing us as gone.
   */
  reannounce: () => void;
  /**
   * Recompute presence. Hiding and returning both change whether the
   * opponent may be blamed for a silence that is really ours.
   */
  refreshPresence: () => void;
};

/** Installs the listeners and returns their teardown. */
export function watchTabLifecycle({
  connection,
  room,
  now,
  reannounce,
  refreshPresence,
}: TabLifecycleOptions): () => void {
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  const persistSnapshot = () => {
    room.persistSnapshot();
  };

  const cancelHideTimer = () => {
    if (hideTimer === null) return;
    clearTimeout(hideTimer);
    hideTimer = null;
  };

  const handleVisibility = () => {
    if (document.hidden) {
      persistSnapshot();
      if (hideTimer === null) {
        hideTimer = setTimeout(() => {
          connection.disconnect();
          room.apply({
            type: "connectivity-changed",
            connected: false,
            now: now(),
          });
          hideTimer = null;
        }, HIDE_DEBOUNCE_MS);
      }
    } else {
      cancelHideTimer();
      if (!connection.connected) {
        connection.connect();
        reannounce();
      }
    }
    room.apply({
      type: "visibility-changed",
      hidden: document.hidden,
      now: now(),
    });
    refreshPresence();
  };

  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("pagehide", persistSnapshot);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibility);
    window.removeEventListener("pagehide", persistSnapshot);
    cancelHideTimer();
  };
}
