import type { Doc } from "yjs";

/**
 * The Connection: how a room's state reaches its peers and survives
 * reloads. Every name derived from a room code — the shard the
 * signaling worker keys its Durable Object on, the local database, the
 * relay credentials endpoint — is derived here and nowhere else, so a
 * rename or a host move lands in one file instead of four.
 *
 * This module is deliberately free of `y-webrtc` / `y-indexeddb`
 * imports: `App.tsx` and `mp-snapshot.ts` need the names, and both sit
 * outside the lazily-loaded multiplayer chunk. The production adapter
 * that pulls the Yjs transport stack in lives in
 * {@link ./mp-connection.webrtc.ts}; the in-memory test adapter lives
 * in {@link ./mp-connection.fake.ts}.
 */

const SIGNALING_HOST = "signal.dokuel.com";

/**
 * Mirrors the signaling worker's Durable Object key truncation (see
 * `MAX_ROOM_KEY_LENGTH` in signaling/src/index.ts). A longer room code
 * would shard inconsistently server-side, so the client refuses it
 * before it ever becomes a connection. Duplicated rather than shared
 * because the worker compiles under its own tsconfig with no path back
 * into `src/`.
 */
export const MAX_ROOM_KEY_LENGTH = 64;

/**
 * Name of the local database holding the room's Yjs update log. The
 * `dokuel_` prefix scopes our databases apart from anything else on the
 * origin. The stale-room sweep deletes by this name, so it must stay
 * the single definition.
 */
export function roomDatabaseName(roomId: string): string {
  return `dokuel_${roomId}`;
}

/**
 * The room's shard: the worker maps each URL path to its own Durable
 * Object, so peers only ever share a socket fanout with their own room.
 * A bare host would land every player in one global object.
 */
export function signalingUrl(roomId: string): string {
  return `wss://${SIGNALING_HOST}/${roomId}`;
}

/**
 * Ephemeral TURN credentials, minted by the signaling worker (see
 * signaling/src/index.ts) so nothing secret ships in the client bundle.
 */
export const TURN_CREDENTIALS_URL = `https://${SIGNALING_HOST}/turn-credentials`;

// Bound the wait: opening a connection blocks on ICE resolution, and a
// slow/broken endpoint must degrade to STUN-only, not a hung lobby.
const TURN_FETCH_TIMEOUT_MS = 3_000;

async function fetchMintedIceServers(): Promise<RTCIceServer[] | null> {
  try {
    const response = await fetch(TURN_CREDENTIALS_URL, {
      signal: AbortSignal.timeout(TURN_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { iceServers?: unknown };
    if (!Array.isArray(body.iceServers)) return null;
    return body.iceServers as RTCIceServer[];
  } catch {
    return null;
  }
}

/**
 * Build-time relay config. STUN-only WebRTC cannot cross the symmetric
 * NAT mobile carriers use, so a deployment that provisions its own
 * relay sets VITE_TURN_URL / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL.
 */
function configuredIceServers(): RTCIceServer[] | null {
  const url = import.meta.env.VITE_TURN_URL;
  if (!url) return null;
  return [
    // Keep STUN for the direct-connection happy path; the relay is the
    // fallback.
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: url,
      username: import.meta.env.VITE_TURN_USERNAME ?? "",
      credential: import.meta.env.VITE_TURN_CREDENTIAL ?? "",
    },
  ];
}

/**
 * ICE precedence, in one place: build-time env config wins; otherwise
 * ask the worker to mint ephemeral credentials; otherwise `null`,
 * meaning "keep the transport's STUN-only defaults". The resolved
 * servers must exist before the peer connection is constructed — they
 * cannot be added to a live one.
 *
 * Successful mints are cached inside the returned resolver: credentials
 * live 24h, far beyond any page session, and a connection is opened on
 * every room navigation. Failures are NOT cached — a transient outage
 * at first join must not doom every later join to STUN-only. Tests get
 * a fresh cache by building a fresh resolver, so no reset hatch ships.
 */
export function createIceServerResolver(
  fetchIceServers: () => Promise<RTCIceServer[] | null> = fetchMintedIceServers,
): () => Promise<RTCIceServer[] | null> {
  let minted: RTCIceServer[] | null = null;
  return async () => {
    const configured = configuredIceServers();
    if (configured) return configured;
    if (minted) return minted;
    minted = await fetchIceServers();
    return minted;
  };
}

/** The presence payload one client publishes about itself. */
export type PresenceUser = { id: string; name: string };

/**
 * One emoji a player threw at their opponent mid-race. `at` and `nonce`
 * exist so the receiver can tell a repeat of the same emoji from the
 * still-standing previous one: presence is last-write-wins state, not a
 * message queue, so "🔥 again" is only visible as a changed nonce.
 */
export type Reaction = { emoji: string; at: number; nonce: string };

/**
 * A player's ephemeral race state, published beside their identity and
 * gone the moment they are: the silhouette of which cells they have
 * filled, and their latest reaction. Never written to the Y.Doc, never
 * persisted, and never carrying a single digit - a mask says *where*
 * the opponent has written, never *what*.
 */
export type PresenceSignal = {
  /** 81 chars, "1" where that player's board holds a value. */
  mask?: string;
  /** Explicitly undefined withdraws a standing reaction. */
  reaction?: Reaction | undefined;
};

/**
 * A synced, locally-persisted doc plus presence for one room, on the
 * best transport available.
 *
 * Invariants a caller must know:
 * - `doc` is live from the moment `open()` resolves; it may still be
 *   empty until `whenSynced` settles.
 * - `whenSynced` resolves once local persistence has finished loading
 *   into `doc`. Writing before then races the restore. It never
 *   rejects.
 * - `connected` reflects the signaling transport only; peers may still
 *   be absent while it is true.
 * - `disconnect()` drops peer connections and signaling sockets but
 *   keeps `doc` and local persistence alive, and (mirroring y-webrtc)
 *   clears our own presence — `announce()` must run again after
 *   `connect()`.
 * - `close()` is terminal: it removes every listener, tears the
 *   transport and persistence down, and destroys `doc`.
 * - The `onX` subscribers return their own unsubscribe function; all of
 *   them are also removed by `close()`.
 *
 * Presence rides on the Connection rather than the Room because it
 * answers "is the opponent reachable", which is a property of the
 * transport. `onPresenceChange` covers both halves of that — a peer
 * joining or leaving the mesh and a peer publishing or clearing its own
 * entry — because no caller has ever wanted to tell them apart.
 */
export type Connection = {
  doc: Doc;
  whenSynced: Promise<void>;
  readonly connected: boolean;
  onStatus(listener: (connected: boolean) => void): () => void;
  /** Fires whenever the reachable set may have changed. */
  onPresenceChange(listener: () => void): () => void;
  /** Publish who we are so peers can tell us apart from a stale entry. */
  announce(user: PresenceUser): void;
  /** True when some other client has announced a different player. */
  hasOtherPeer(ownPlayerId: string): boolean;
  /**
   * Publish ephemeral race state, merged into whatever we published
   * before, so a mask update does not erase a standing reaction.
   */
  signal(signal: PresenceSignal): void;
  /** The other player's ephemeral state, or null while nobody publishes one. */
  opponentSignal(ownPlayerId: string): PresenceSignal | null;
  connect(): void;
  disconnect(): void;
  close(): void;
};

/** What a caller may ask of an {@link OpenConnection}. */
export type OpenOptions = {
  /**
   * Abandons an open the caller no longer wants. Opening is async, and
   * a transport built for a room nobody is in any more is not merely
   * wasteful: y-webrtc keys its room registry globally by name, so the
   * abandoned one claims the slot the live one needs.
   */
  signal?: AbortSignal;
};

/**
 * The seam. Two adapters satisfy it: the WebRTC/IndexedDB/TURN one used
 * in production and the in-memory one used by tests. Resolution is
 * async because ICE servers must be known before the peer connection
 * exists.
 *
 * An aborted open constructs nothing and leaves nothing behind: it
 * rejects with an `AbortError` DOMException, tearing down anything it
 * had already built before the abort landed. A caller that aborts must
 * expect that rejection and treat it as the normal outcome.
 */
export type OpenConnection = (
  roomId: string,
  options?: OpenOptions,
) => Promise<Connection>;
