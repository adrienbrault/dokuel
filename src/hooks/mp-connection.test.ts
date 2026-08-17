import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness";
import { WebrtcProvider } from "y-webrtc";
import { Doc } from "yjs";
import {
  createFakeConnections,
  type FakeConnection,
} from "./mp-connection.fake.ts";
import {
  type Connection,
  createIceServerResolver,
  MAX_ROOM_KEY_LENGTH,
  type OpenOptions,
  roomDatabaseName,
  signalingUrl,
  TURN_CREDENTIALS_URL,
} from "./mp-connection.ts";
import { createWebrtcConnectionOpener } from "./mp-connection.webrtc.ts";

const MINTED = [
  { urls: ["stun:stun.cloudflare.com:3478"] },
  {
    urls: ["turn:turn.cloudflare.com:3478?transport=udp"],
    username: "ephemeral-user",
    credential: "ephemeral-pass",
  },
];

function stubFetchOk(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("room-derived names", () => {
  it("scopes the local database to the room under a dokuel_ prefix", () => {
    // The stale-room sweep deletes databases by this name; the two must
    // never drift apart.
    expect(roomDatabaseName("brave-otter-1a2b")).toBe(
      "dokuel_brave-otter-1a2b",
    );
  });

  it("addresses the room's own signaling shard via the URL path", () => {
    // The worker maps each path to its own Durable Object. A bare host
    // would land every player in one global object — a single point of
    // contention and a cross-room fanout surface.
    expect(signalingUrl("brave-otter-1a2b")).toBe(
      "wss://signal.dokuel.com/brave-otter-1a2b",
    );
  });

  it("caps the room key where the signaling worker truncates it", () => {
    // A longer code would shard inconsistently server-side.
    expect(MAX_ROOM_KEY_LENGTH).toBe(64);
  });
});

describe("createIceServerResolver", () => {
  it("prefers build-time env config over minting", async () => {
    // simple-peer's default is STUN-only, which cannot traverse
    // symmetric NAT (mobile carriers) — two phones on different
    // carriers hang on "Connecting..." forever. A deployment that
    // provisions its own TURN credentials must be able to inject them.
    vi.stubEnv("VITE_TURN_URL", "turn:turn.example.com:3478");
    vi.stubEnv("VITE_TURN_USERNAME", "user");
    vi.stubEnv("VITE_TURN_CREDENTIAL", "pass");
    const mint = vi.fn().mockResolvedValue(MINTED);

    const servers = await createIceServerResolver(mint)();

    expect(servers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          urls: "turn:turn.example.com:3478",
          username: "user",
          credential: "pass",
        }),
      ]),
    );
    expect(mint).not.toHaveBeenCalled();
  });

  it("keeps STUN alongside the configured relay", () => {
    // The relay is the fallback, not the first choice: a direct
    // connection is cheaper and lower latency.
    vi.stubEnv("VITE_TURN_URL", "turn:turn.example.com:3478");

    return expect(createIceServerResolver(vi.fn())()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ urls: "stun:stun.l.google.com:19302" }),
      ]),
    );
  });

  it("falls back to worker-minted credentials without env config", async () => {
    const servers = await createIceServerResolver(
      vi.fn().mockResolvedValue(MINTED),
    )();

    expect(servers).toEqual(MINTED);
  });

  it("resolves null when no relay is available at all", async () => {
    // The transport keeps its STUN-only defaults — today's behaviour
    // when the worker has no TURN key.
    expect(
      await createIceServerResolver(vi.fn().mockResolvedValue(null))(),
    ).toBeNull();
  });

  it("reuses minted credentials across calls instead of refetching", async () => {
    const mint = vi.fn().mockResolvedValue(MINTED);
    const resolve = createIceServerResolver(mint);

    await resolve();

    expect(await resolve()).toEqual(MINTED);
    expect(mint).toHaveBeenCalledTimes(1);
  });

  it("retries after a failed mint instead of caching the null", async () => {
    // A transient outage at first join must not doom every later join
    // to STUN-only.
    const mint = vi.fn().mockResolvedValueOnce(null).mockResolvedValue(MINTED);
    const resolve = createIceServerResolver(mint);

    expect(await resolve()).toBeNull();

    expect(await resolve()).toEqual(MINTED);
  });
});

describe("minting TURN credentials from the signaling worker", () => {
  it("returns the iceServers the worker minted", async () => {
    const fetchMock = stubFetchOk({ iceServers: MINTED });

    expect(await createIceServerResolver()()).toEqual(MINTED);
    expect(fetchMock).toHaveBeenCalledWith(
      TURN_CREDENTIALS_URL,
      expect.anything(),
    );
  });

  it("returns null when the worker has no TURN key configured (404)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("TURN not configured", { status: 404 }),
        ),
    );

    expect(await createIceServerResolver()()).toBeNull();
  });

  it("returns null when the request fails or times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    expect(await createIceServerResolver()()).toBeNull();
  });

  it("returns null when the body is not an iceServers array", async () => {
    stubFetchOk({ error: "unexpected shape" });

    expect(await createIceServerResolver()()).toBeNull();
  });
});

/**
 * The WebRTC adapter's open sequence — what it builds, and in which
 * order. Stated here rather than in the contract suite because it is
 * about this adapter's own outside world (a relay mint that may hang
 * for its whole timeout) rather than about the Connection interface.
 */
describe("the WebRTC adapter's open sequence", () => {
  function neverDestroyedPersistence() {
    return { whenSynced: Promise.resolve(), destroy() {} };
  }

  it("opens local persistence without waiting for relay credentials", () => {
    // Only the peer connection needs the iceServers. Blocking the doc
    // and its local database on the mint puts the restore the player
    // is waiting for behind a round trip to a host that may be
    // unreachable.
    let openedPersistence = false;
    const open = createWebrtcConnectionOpener({
      resolveIceServers: () => new Promise(() => {}),
      openPersistence: () => {
        openedPersistence = true;
        return neverDestroyedPersistence();
      },
      openProvider: () => {
        throw new Error("the provider must wait for the iceServers");
      },
    });

    void open("ice-pending-room");

    expect(openedPersistence).toBe(true);
  });

  it("closes what it already built when the open is abandoned", () => {
    // The doc and its database handle exist before the credentials
    // land, and no caller ever sees them — an abort after that point
    // is their only chance to close.
    const controller = new AbortController();
    let destroyed = false;
    let mint: (servers: RTCIceServer[] | null) => void = () => {};
    const open = createWebrtcConnectionOpener({
      resolveIceServers: () =>
        new Promise((resolve) => {
          mint = resolve;
        }),
      openPersistence: () => ({
        whenSynced: Promise.resolve(),
        destroy() {
          destroyed = true;
        },
      }),
      openProvider: () => {
        throw new Error("no provider for an abandoned open");
      },
    });

    const opening = open("abandoned-room", { signal: controller.signal });
    controller.abort();
    mint(null);

    return expect(opening)
      .rejects.toMatchObject({ name: "AbortError" })
      .then(() => {
        expect(destroyed).toBe(true);
      });
  });
});

/**
 * One contract, two adapters. Everything below is stated against the
 * {@link Connection} interface and run against both implementations of
 * it, so a divergence between the in-memory adapter the hook tests rely
 * on and the WebRTC one that actually ships shows up here rather than
 * in production. The interface is the test surface.
 *
 * The WebRTC row runs a REAL `WebrtcProvider` — with a signaling list
 * that never connects — because its listener bookkeeping is the part
 * the fake cannot vouch for. Only persistence is substituted: jsdom has
 * no `indexedDB`, and adding a shim dependency to reach one line would
 * buy nothing the stub does not.
 */
type OpenedConnection = {
  connection: Connection;
  /** The awareness the connection's presence rides on. */
  awareness: Awareness;
  /** Fire the transport's status event the way the transport would. */
  fireStatus(connected: boolean): void;
  /** Idempotent teardown, so a test may close and still be cleaned up. */
  closeOnce(): void;
};

type AdapterUnderTest = {
  open(roomId: string, options?: OpenOptions): Promise<OpenedConnection>;
  /** How many transports the adapter has actually built. */
  built(): number;
};

function once(teardown: () => void): () => void {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    teardown();
  };
}

function fakeAdapter(): AdapterUnderTest {
  const connections = createFakeConnections();
  return {
    built: () => connections.all.length,
    async open(roomId, options) {
      const connection = (await connections.open(
        roomId,
        options,
      )) as FakeConnection;
      return {
        connection,
        awareness: connection.awareness,
        fireStatus: (connected) => connection.emitStatus(connected),
        closeOnce: once(() => {
          connection.close();
          connection.awareness.destroy();
        }),
      };
    },
  };
}

function webrtcAdapter(): AdapterUnderTest {
  const providers: WebrtcProvider[] = [];
  const open = createWebrtcConnectionOpener({
    resolveIceServers: async () => null,
    openPersistence: () => ({
      whenSynced: Promise.resolve(),
      destroy() {},
    }),
    openProvider: (name, doc) => {
      // No signaling endpoints: the provider is real and its listener
      // plumbing is live, but it never reaches the network.
      const provider = new WebrtcProvider(name, doc, {
        signaling: [],
        filterBcConns: true,
      });
      providers.push(provider);
      return provider;
    },
  });
  return {
    built: () => providers.length,
    async open(roomId, options) {
      const connection = await open(roomId, options);
      const provider = providers.at(-1);
      if (!provider) throw new Error("the adapter constructed no provider");
      const { awareness } = provider;
      return {
        connection,
        awareness,
        fireStatus: (connected) => provider.emit("status", [{ connected }]),
        closeOnce: once(() => {
          connection.close();
          awareness.destroy();
        }),
      };
    },
  };
}

let contractRoomSeq = 0;

describe.each([
  ["in-memory adapter", fakeAdapter],
  ["WebRTC adapter", webrtcAdapter],
])("Connection contract: %s", (_label, createAdapter) => {
  let opened: OpenedConnection[] = [];
  let adapter: AdapterUnderTest;

  beforeEach(() => {
    adapter = createAdapter();
  });

  /** A name no other connection in this suite has used. */
  function freshRoomId(): string {
    contractRoomSeq += 1;
    // y-webrtc keeps one global registry keyed by room name, so every
    // connection in this suite needs a name of its own.
    return `contract-room-${contractRoomSeq}`;
  }

  async function openConnection(): Promise<OpenedConnection> {
    const room = await adapter.open(freshRoomId());
    opened.push(room);
    return room;
  }

  /**
   * Play a second client: build a remote awareness, announce a user on
   * it, and merge it in — what the transport does when a peer shows up.
   */
  function peerAnnounces(
    room: OpenedConnection,
    user: { id: string; name: string },
  ): void {
    const peerDoc = new Doc();
    const peerAwareness = new Awareness(peerDoc);
    peerAwareness.setLocalState({ user });
    applyAwarenessUpdate(
      room.awareness,
      encodeAwarenessUpdate(peerAwareness, [peerDoc.clientID]),
      "test",
    );
    peerAwareness.destroy();
  }

  afterEach(() => {
    for (const room of opened) room.closeOnce();
    opened = [];
  });

  it("builds nothing for an open that was aborted", async () => {
    // The caller left the room while the open was in flight. Building
    // the transport anyway would claim y-webrtc's globally named room
    // slot away from the open that replaced this one, and the live
    // room would never connect.
    const controller = new AbortController();
    controller.abort();

    await expect(
      adapter.open(freshRoomId(), { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(adapter.built()).toBe(0);
  });

  it("resolves whenSynced once local persistence has loaded", async () => {
    // Nothing may be written before this settles, so a caller blocked on
    // it must never be left hanging — or rejected.
    const { connection } = await openConnection();

    await expect(connection.whenSynced).resolves.toBeUndefined();
  });

  it("publishes the player identity for peers to read", async () => {
    const room = await openConnection();

    room.connection.announce({ id: "p1", name: "Alice" });

    expect(room.awareness.getLocalState()).toEqual({
      user: { id: "p1", name: "Alice" },
    });
  });

  it("re-announces after a disconnect cleared our presence", async () => {
    // Dropping the transport for a backgrounded tab removes our own
    // awareness entry, leaving local state null. Announcing must work
    // from that starting point or the opponent keeps seeing us as gone
    // and is offered a forfeit win while we are actively playing.
    const room = await openConnection();
    room.connection.announce({ id: "p1", name: "Alice" });

    room.connection.disconnect();
    expect(room.awareness.getLocalState()).toBeNull();
    room.connection.announce({ id: "p1", name: "Alice" });

    expect(room.awareness.getLocalState()).toEqual({
      user: { id: "p1", name: "Alice" },
    });
  });

  it("does not mistake our own announcement for another peer", async () => {
    const room = await openConnection();

    room.connection.announce({ id: "p1", name: "Alice" });

    expect(room.connection.hasOtherPeer("p1")).toBe(false);
  });

  it("sees a peer that announced a different player", async () => {
    const room = await openConnection();
    room.connection.announce({ id: "p1", name: "Alice" });

    peerAnnounces(room, { id: "p2", name: "Bob" });

    expect(room.connection.hasOtherPeer("p1")).toBe(true);
  });

  it("ignores another client carrying our own player id", async () => {
    // Our own second tab, or the entry our previous session left behind:
    // a different clientID but the same player. Counting it would keep
    // the room looking populated to a player who is actually alone.
    const room = await openConnection();

    peerAnnounces(room, { id: "p1", name: "Alice" });

    expect(room.connection.hasOtherPeer("p1")).toBe(false);
  });

  it("notifies presence subscribers when a peer announces", async () => {
    const room = await openConnection();
    const listener = vi.fn();
    room.connection.onPresenceChange(listener);

    peerAnnounces(room, { id: "p2", name: "Bob" });

    expect(listener).toHaveBeenCalled();
  });

  it("stops notifying an unsubscribed presence listener", async () => {
    const room = await openConnection();
    const listener = vi.fn();

    room.connection.onPresenceChange(listener)();
    peerAnnounces(room, { id: "p2", name: "Bob" });

    expect(listener).not.toHaveBeenCalled();
  });

  it("reports the transport's status to subscribers", async () => {
    const room = await openConnection();
    const listener = vi.fn();
    room.connection.onStatus(listener);

    room.fireStatus(true);

    expect(listener).toHaveBeenCalledWith(true);
  });

  it("stops notifying an unsubscribed status listener", async () => {
    // The WebRTC adapter wraps the listener before handing it to the
    // provider, so its unsubscribe has to remember the wrapper — an
    // easy thing to get wrong and impossible to see from the fake.
    const room = await openConnection();
    const listener = vi.fn();

    room.connection.onStatus(listener)();
    room.fireStatus(true);

    expect(listener).not.toHaveBeenCalled();
  });

  it("delivers nothing to listeners left over at close", async () => {
    const room = await openConnection();
    const onStatus = vi.fn();
    const onPresence = vi.fn();
    room.connection.onStatus(onStatus);
    room.connection.onPresenceChange(onPresence);

    room.closeOnce();
    room.fireStatus(true);
    peerAnnounces(room, { id: "p2", name: "Bob" });

    expect(onStatus).not.toHaveBeenCalled();
    expect(onPresence).not.toHaveBeenCalled();
  });
});
