import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import { applyUpdate, Doc } from "yjs";
import { awarenessPresence } from "./mp-connection.presence.ts";
import type {
  Connection,
  OpenConnection,
  OpenOptions,
} from "./mp-connection.ts";

/**
 * Test adapter for the {@link Connection} seam: an in-memory doc with
 * no transport at all. Tests drive the transport events themselves
 * instead of mocking `y-webrtc` / `y-indexeddb` module by module.
 *
 * Awareness is the REAL y-protocols implementation — its semantics
 * (notably: `setLocalStateField` silently no-ops while local state is
 * null, which is what `disconnect()` leaves behind) are exactly what
 * presence bugs hide behind, so faking it would fake away the risk.
 */

export type FakeConnection = Omit<Connection, "connected"> & {
  roomId: string;
  /**
   * The awareness behind `announce`/`hasOtherPeer`, exposed so a test
   * can play the opponent by merging in a remote awareness update.
   */
  awareness: Awareness;
  connected: boolean;
  connectCount: number;
  disconnectCount: number;
  closed: boolean;
  /** Fire the transport status listeners. */
  emitStatus(connected: boolean): void;
  /** Fire the presence listeners as a peer-set change would. */
  emitPresence(): void;
  /**
   * Play the opponent: publish this awareness state under a foreign
   * client id, exactly as a remote peer's update would arrive. Repeated
   * calls come from the same imaginary peer, so a later state replaces
   * the earlier one instead of adding a third player to the room.
   */
  emitRemotePeer(state: Record<string, unknown>): void;
};

export type FakeConnections = {
  open: OpenConnection;
  /**
   * Every connection this factory has CONSTRUCTED, in order. An open
   * that never got that far leaves no entry, so a test can tell an
   * abandoned open apart from a transport that was really built.
   */
  readonly all: readonly FakeConnection[];
  /** The most recently opened connection, or null before the first. */
  readonly last: FakeConnection | null;
  /**
   * Update applied to the doc as part of `whenSynced`, mirroring how
   * y-indexeddb loads persisted state asynchronously after the doc
   * already exists. Set it before the connection is opened.
   */
  persistedUpdate: Uint8Array | null;
};

export function createFakeConnections(): FakeConnections {
  const opened: FakeConnection[] = [];

  const factory: FakeConnections = {
    persistedUpdate: null,
    get all() {
      return opened;
    },
    get last() {
      return opened.at(-1) ?? null;
    },
    open: async (roomId: string, options?: OpenOptions) => {
      // The production adapter resolves ICE servers before it builds
      // anything, so every open has a window in which the caller can
      // walk away. Yielding once here keeps that window — and the
      // abort contract that covers it — real for the tests.
      await Promise.resolve();
      options?.signal?.throwIfAborted();

      const doc = new Doc();
      const awareness = new Awareness(doc);
      const statusListeners = new Set<(connected: boolean) => void>();
      const peerListeners = new Set<() => void>();
      const presence = awarenessPresence(awareness);
      // Built on first use so a test that never plays the opponent
      // leaves no second awareness to destroy.
      let remoteAwareness: Awareness | null = null;
      const seed = factory.persistedUpdate;

      const connection: FakeConnection = {
        roomId,
        doc,
        awareness,
        whenSynced: Promise.resolve().then(() => {
          if (seed) applyUpdate(doc, seed);
        }),
        connected: false,
        connectCount: 0,
        disconnectCount: 0,
        closed: false,
        announce: presence.announce,
        hasOtherPeer: presence.hasOtherPeer,
        signal: presence.signal,
        opponentSignal: presence.opponentSignal,
        onStatus(listener) {
          statusListeners.add(listener);
          return () => statusListeners.delete(listener);
        },
        onPresenceChange(listener) {
          const unsubscribeAwareness = presence.onPresenceChange(listener);
          peerListeners.add(listener);
          return () => {
            unsubscribeAwareness();
            peerListeners.delete(listener);
          };
        },
        connect() {
          connection.connected = true;
          connection.connectCount += 1;
        },
        disconnect() {
          connection.connected = false;
          connection.disconnectCount += 1;
          // Mirror y-webrtc Room.disconnect(): the local client's
          // awareness entry is removed, leaving local state null until
          // it is re-announced.
          removeAwarenessStates(awareness, [doc.clientID], "disconnect");
        },
        close() {
          connection.closed = true;
          statusListeners.clear();
          peerListeners.clear();
          presence.removeAllListeners();
          remoteAwareness?.destroy();
          awareness.destroy();
        },
        emitStatus(connected) {
          connection.connected = connected;
          for (const listener of statusListeners) listener(connected);
        },
        emitPresence() {
          for (const listener of peerListeners) listener();
        },
        emitRemotePeer(state) {
          remoteAwareness ??= new Awareness(new Doc());
          remoteAwareness.setLocalState(state);
          applyAwarenessUpdate(
            awareness,
            encodeAwarenessUpdate(remoteAwareness, [
              remoteAwareness.doc.clientID,
            ]),
            "remote",
          );
        },
      };

      opened.push(connection);
      return connection;
    },
  };

  return factory;
}
