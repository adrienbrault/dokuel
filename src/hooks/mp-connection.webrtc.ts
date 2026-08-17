import { IndexeddbPersistence } from "y-indexeddb";
import { WebrtcProvider } from "y-webrtc";
import { Doc } from "yjs";
import { awarenessPresence } from "./mp-connection.presence.ts";
import {
  type Connection,
  createIceServerResolver,
  type OpenConnection,
  type OpenOptions,
  roomDatabaseName,
  signalingUrl,
} from "./mp-connection.ts";

/**
 * Production adapter for the {@link Connection} seam: y-webrtc for the
 * peer link and signaling, y-indexeddb for local persistence, and an
 * optional TURN relay in front of both. The only module in the app that
 * imports the Yjs transport stack, which is why it stays inside the
 * lazily-loaded multiplayer chunk.
 */

// y-webrtc fans a room's traffic out to every peer; four is plenty for
// a 1v1 room plus stragglers, and filterBcConns keeps a second tab from
// eating a slot over BroadcastChannel.
const MAX_PEER_CONNECTIONS = 4;

/** All this adapter needs from local persistence. */
export type LocalPersistence = {
  whenSynced: Promise<unknown>;
  destroy(): void;
};

/**
 * The three things this adapter reaches outside itself for. They are
 * parameters rather than direct calls so the Connection contract suite
 * can run the adapter's REAL listener bookkeeping — the provider stays
 * a genuine WebrtcProvider — under a test environment that has no
 * `indexedDB` for the persistence half.
 */
export type WebrtcInternals = {
  resolveIceServers: () => Promise<RTCIceServer[] | null>;
  openPersistence: (databaseName: string, doc: Doc) => LocalPersistence;
  openProvider: (
    roomId: string,
    doc: Doc,
    iceServers: RTCIceServer[] | null,
  ) => WebrtcProvider;
};

export function createWebrtcConnectionOpener({
  resolveIceServers,
  openPersistence,
  openProvider,
}: WebrtcInternals): OpenConnection {
  return async (roomId: string, options?: OpenOptions): Promise<Connection> => {
    options?.signal?.throwIfAborted();
    // Started here, awaited below: only the peer connection needs the
    // relay credentials. The local restore — the thing the player is
    // actually waiting for — must not queue behind a round trip to a
    // signaling host that may be unreachable for its whole timeout.
    const minting = resolveIceServers();

    const doc = new Doc();
    const persistence = openPersistence(roomDatabaseName(roomId), doc);

    // The one thing that genuinely has to wait: iceServers cannot be
    // added to a live peer connection.
    const iceServers = await minting;
    if (options?.signal?.aborted) {
      // Abandoned while the credentials were in flight. Nothing else
      // holds the doc or the database handle, so this is their only
      // chance to close — and building a provider for a room nobody is
      // in would claim y-webrtc's globally named room slot away from
      // the open that replaced us.
      persistence.destroy();
      doc.destroy();
    }
    options?.signal?.throwIfAborted();

    const provider = openProvider(roomId, doc, iceServers);

    const statusListeners = new Set<
      (payload: { connected: boolean }) => void
    >();
    const peerListeners = new Set<() => void>();
    const presence = awarenessPresence(provider.awareness);

    return {
      doc,
      whenSynced: persistence.whenSynced.then(() => undefined),
      get connected() {
        return provider.connected;
      },
      announce: presence.announce,
      hasOtherPeer: presence.hasOtherPeer,
      onStatus(listener) {
        const wrapped = ({ connected }: { connected: boolean }) =>
          listener(connected);
        statusListeners.add(wrapped);
        provider.on("status", wrapped);
        return () => {
          statusListeners.delete(wrapped);
          provider.off("status", wrapped);
        };
      },
      onPresenceChange(listener) {
        // Two transport events answer the same question: the peer set
        // changed, or a peer rewrote its awareness entry.
        const unsubscribeAwareness = presence.onPresenceChange(listener);
        peerListeners.add(listener);
        provider.on("peers", listener);
        return () => {
          unsubscribeAwareness();
          peerListeners.delete(listener);
          provider.off("peers", listener);
        };
      },
      connect() {
        provider.connect();
      },
      disconnect() {
        provider.disconnect();
      },
      close() {
        for (const listener of statusListeners)
          provider.off("status", listener);
        for (const listener of peerListeners) provider.off("peers", listener);
        statusListeners.clear();
        peerListeners.clear();
        presence.removeAllListeners();
        provider.disconnect();
        provider.destroy();
        persistence.destroy();
        doc.destroy();
      },
    };
  };
}

export const openWebrtcConnection: OpenConnection =
  createWebrtcConnectionOpener({
    // One resolver per page session, not per connection: minted
    // credentials live far longer than a session, and a connection is
    // opened on every room navigation.
    resolveIceServers: createIceServerResolver(),
    openPersistence: (databaseName, doc) =>
      new IndexeddbPersistence(databaseName, doc),
    openProvider: (roomId, doc, iceServers) =>
      new WebrtcProvider(roomId, doc, {
        signaling: [signalingUrl(roomId)],
        maxConns: MAX_PEER_CONNECTIONS,
        filterBcConns: true,
        ...(iceServers ? { peerOpts: { config: { iceServers } } } : {}),
      }),
  });
