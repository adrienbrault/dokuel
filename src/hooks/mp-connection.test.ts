import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createIceServerResolver,
  MAX_ROOM_KEY_LENGTH,
  roomDatabaseName,
  signalingUrl,
  TURN_CREDENTIALS_URL,
} from "./mp-connection.ts";

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
