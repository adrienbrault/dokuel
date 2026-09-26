import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc } from "yjs";
import {
  roomDatabaseName,
  signalingUrl,
  TURN_CREDENTIALS_URL,
} from "./mp-connection.ts";

/**
 * The production adapter's own wiring: what `openWebrtcConnection`
 * hands `WebrtcProvider` and `IndexeddbPersistence`. The Connection
 * contract suite injects its own transport internals — deliberately,
 * so the contract stays about behaviour — which leaves this object
 * literal, the one that actually ships, running in no test at all.
 * Every value in it is load-bearing: the signaling path is the room's
 * shard, the database name is what the stale-room sweep deletes by,
 * and `peerOpts` is the only way relay credentials ever reach a peer
 * connection.
 *
 * The two transport modules are mocked rather than substituted through
 * the seam, because the point here is precisely the arguments the
 * module's own defaults pass to them.
 */
const captured = vi.hoisted(() => ({
  providerRoom: null as string | null,
  providerDoc: null as unknown,
  providerOptions: null as Record<string, unknown> | null,
  persistenceName: null as string | null,
  persistenceDoc: null as unknown,
  webrtcConns: new Map<string, unknown>(),
}));

vi.mock("y-webrtc", async () => {
  const { Awareness } = await import("y-protocols/awareness");
  class FakeWebrtcProvider {
    // Annotated through the module type: the class binding only exists
    // inside this hoisted factory.
    awareness: import("y-protocols/awareness").Awareness;
    connected = false;
    constructor(roomId: string, doc: Doc, options: Record<string, unknown>) {
      captured.providerRoom = roomId;
      captured.providerDoc = doc;
      captured.providerOptions = options;
      this.awareness = new Awareness(doc);
    }
    // y-webrtc's own shape: the room keyed by name, holding one
    // WebrtcConn (wrapping a simple-peer, wrapping the
    // RTCPeerConnection) per remote peer.
    room = { webrtcConns: captured.webrtcConns };
    on() {}
    off() {}
    connect() {}
    disconnect() {}
    destroy() {
      this.awareness.destroy();
    }
  }
  return { WebrtcProvider: FakeWebrtcProvider };
});

vi.mock("y-indexeddb", () => {
  class FakeIndexeddbPersistence {
    whenSynced = Promise.resolve(this);
    constructor(name: string, doc: Doc) {
      captured.persistenceName = name;
      captured.persistenceDoc = doc;
    }
    destroy() {}
  }
  return { IndexeddbPersistence: FakeIndexeddbPersistence };
});

const MINTED: RTCIceServer[] = [
  { urls: ["stun:stun.cloudflare.com:3478"] },
  {
    urls: ["turn:turn.cloudflare.com:3478?transport=udp"],
    username: "ephemeral-user",
    credential: "ephemeral-pass",
  },
];

/**
 * A fresh module instance per test: the shipped adapter builds ONE ICE
 * resolver at import time and that resolver caches its mint, so a
 * second test would otherwise read the first one's credentials.
 */
async function openRoom(roomId: string) {
  vi.resetModules();
  const { openWebrtcConnection } = await import("./mp-connection.webrtc.ts");
  return openWebrtcConnection(roomId);
}

function stubMint(iceServers: RTCIceServer[] | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      expect(url).toBe(TURN_CREDENTIALS_URL);
      return iceServers === null
        ? new Response("TURN not configured", { status: 404 })
        : new Response(JSON.stringify({ iceServers }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
    }),
  );
}

beforeEach(() => {
  captured.providerRoom = null;
  captured.providerDoc = null;
  captured.providerOptions = null;
  captured.persistenceName = null;
  captured.persistenceDoc = null;
  captured.webrtcConns.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("openWebrtcConnection", () => {
  it("points the provider at the room's own signaling shard", async () => {
    stubMint(null);

    const connection = await openRoom("brave-otter-1a2b");

    expect(captured.providerRoom).toBe("brave-otter-1a2b");
    expect(captured.providerDoc).toBe(connection.doc);
    expect(captured.providerOptions).toMatchObject({
      signaling: [signalingUrl("brave-otter-1a2b")],
      // Four peers is plenty for a 1v1 room plus stragglers, and
      // filtering BroadcastChannel connections keeps a second tab from
      // eating one of the slots.
      maxConns: 4,
      filterBcConns: true,
    });
    connection.close();
  });

  it("hands the minted relay credentials to the peer connection", async () => {
    // iceServers cannot be attached to a live RTCPeerConnection, so
    // `peerOpts` at construction is the only route they have. Without
    // them a cellular peer never traverses carrier NAT and the game
    // hangs on "Connecting".
    stubMint(MINTED);

    const connection = await openRoom("relay-room");

    expect(captured.providerOptions?.peerOpts).toEqual({
      config: { iceServers: MINTED },
    });
    connection.close();
  });

  it("keeps the transport's STUN-only defaults with no relay to offer", async () => {
    // The worker has no TURN key configured. Passing an empty
    // `peerOpts` would override simple-peer's own defaults with
    // nothing.
    stubMint(null);

    const connection = await openRoom("stun-only-room");

    expect(captured.providerOptions).not.toHaveProperty("peerOpts");
    connection.close();
  });

  it("persists the room into its own prefixed local database", async () => {
    // The stale-room sweep deletes databases by this name; an adapter
    // naming them anything else would leak a database per room.
    stubMint(null);

    const connection = await openRoom("brave-otter-1a2b");

    expect(captured.persistenceName).toBe(roomDatabaseName("brave-otter-1a2b"));
    expect(captured.persistenceDoc).toBe(connection.doc);
    connection.close();
  });

  it("reads the ICE route off a connected peer's stats", async () => {
    stubMint(null);
    const stats = new Map<string, Record<string, unknown>>([
      ["T", { id: "T", type: "transport", selectedCandidatePairId: "P" }],
      [
        "P",
        {
          id: "P",
          type: "candidate-pair",
          localCandidateId: "L",
          remoteCandidateId: "R",
        },
      ],
      ["L", { id: "L", type: "local-candidate", candidateType: "relay" }],
      ["R", { id: "R", type: "remote-candidate", candidateType: "host" }],
    ]);
    const unusable = () => Promise.reject(new Error("not connected"));
    captured.webrtcConns.set("still-dialing", {
      connected: false,
      peer: { _pc: { getStats: unusable } },
    });
    captured.webrtcConns.set("live", {
      connected: true,
      peer: { _pc: { getStats: () => Promise.resolve(stats) } },
    });

    const connection = await openRoom("route-room");

    expect(await connection.iceRoute?.()).toEqual({
      local: "relay",
      remote: "host",
    });
    connection.close();
  });

  it("has no ICE route without a connected WebRTC peer", async () => {
    stubMint(null);

    const connection = await openRoom("no-route-room");

    expect(await connection.iceRoute?.()).toBeNull();
    connection.close();
  });
});
