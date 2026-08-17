import { IndexeddbPersistence } from "y-indexeddb";
import { WebrtcProvider } from "y-webrtc";
import { Doc } from "yjs";
import { awarenessPresence } from "./mp-connection.presence.ts";
import {
  type Connection,
  createIceServerResolver,
  type OpenConnection,
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

// One resolver per page session, not per connection: minted credentials
// live far longer than a session, and a connection is opened on every
// room navigation.
const resolveIceServers = createIceServerResolver();

// y-webrtc fans a room's traffic out to every peer; four is plenty for
// a 1v1 room plus stragglers, and filterBcConns keeps a second tab from
// eating a slot over BroadcastChannel.
const MAX_PEER_CONNECTIONS = 4;

export const openWebrtcConnection: OpenConnection = async (
  roomId: string,
): Promise<Connection> => {
  // Resolved before anything else exists: iceServers cannot be added to
  // a live peer connection, and the fetch behind this is bounded so a
  // broken endpoint only delays — never blocks — the room.
  const iceServers = await resolveIceServers();

  const doc = new Doc();
  const persistence = new IndexeddbPersistence(roomDatabaseName(roomId), doc);
  const provider = new WebrtcProvider(roomId, doc, {
    signaling: [signalingUrl(roomId)],
    maxConns: MAX_PEER_CONNECTIONS,
    filterBcConns: true,
    ...(iceServers ? { peerOpts: { config: { iceServers } } } : {}),
  });

  const statusListeners = new Set<(payload: { connected: boolean }) => void>();
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
      for (const listener of statusListeners) provider.off("status", listener);
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
