import type { Awareness } from "y-protocols/awareness";
import type { Connection, PresenceUser } from "./mp-connection.ts";

/**
 * Presence over a y-protocols Awareness: whether the opponent is
 * currently *reachable*, and how we make ourselves reachable to them.
 * That is a {@link ./mp-connection.ts Connection} mechanism, so both
 * adapters build their presence surface from here — the WebRTC one over
 * the provider's awareness, the in-memory one over an awareness of its
 * own. "Seated but absent" is a Room rule and stays in the Room.
 *
 * Type-only import: `y-protocols` is a devDependency reached at runtime
 * through `y-webrtc`, so nothing here may pull it in itself.
 */

/**
 * The presence half of the {@link Connection} interface — derived from
 * it rather than restated, so the two cannot drift — plus the teardown
 * hook an adapter's own `close()` calls.
 */
export type Presence = Pick<
  Connection,
  "announce" | "hasOtherPeer" | "onPresenceChange"
> & {
  /** Drop every listener this helper installed. */
  removeAllListeners(): void;
};

export function awarenessPresence(awareness: Awareness): Presence {
  const listeners = new Set<() => void>();

  return {
    announce(user) {
      // Not setLocalStateField: that helper silently no-ops while the
      // local state is null — which is what a disconnect leaves behind
      // after we drop the transport for a backgrounded tab. Rebuilding
      // the state object makes re-announcing work from any starting
      // point.
      awareness.setLocalState({
        ...(awareness.getLocalState() ?? {}),
        user,
      });
    },
    hasOtherPeer(ownPlayerId) {
      for (const [clientId, state] of awareness.getStates()) {
        const user = (state as { user?: PresenceUser }).user;
        if (
          clientId !== awareness.clientID &&
          user &&
          user.id !== ownPlayerId
        ) {
          return true;
        }
      }
      return false;
    },
    onPresenceChange(listener) {
      listeners.add(listener);
      awareness.on("change", listener);
      return () => {
        listeners.delete(listener);
        awareness.off("change", listener);
      };
    },
    removeAllListeners() {
      for (const listener of listeners) awareness.off("change", listener);
      listeners.clear();
    },
  };
}
