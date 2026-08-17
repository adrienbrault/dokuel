import { Awareness, removeAwarenessStates } from "y-protocols/awareness";
import { applyUpdate, Doc } from "yjs";
import type { Connection, OpenConnection } from "./mp-connection.ts";

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
  connected: boolean;
  connectCount: number;
  disconnectCount: number;
  closed: boolean;
  /** Fire the transport status listeners. */
  emitStatus(connected: boolean): void;
  /** Fire the peer-set listeners. */
  emitPeers(): void;
};

export type FakeConnections = {
  open: OpenConnection;
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
    get last() {
      return opened.at(-1) ?? null;
    },
    open: async (roomId: string) => {
      const doc = new Doc();
      const awareness = new Awareness(doc);
      const statusListeners = new Set<(connected: boolean) => void>();
      const peerListeners = new Set<() => void>();
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
        onStatus(listener) {
          statusListeners.add(listener);
          return () => statusListeners.delete(listener);
        },
        onPeersChange(listener) {
          peerListeners.add(listener);
          return () => peerListeners.delete(listener);
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
          awareness.destroy();
        },
        emitStatus(connected) {
          connection.connected = connected;
          for (const listener of statusListeners) listener(connected);
        },
        emitPeers() {
          for (const listener of peerListeners) listener();
        },
      };

      opened.push(connection);
      return connection;
    },
  };

  return factory;
}
