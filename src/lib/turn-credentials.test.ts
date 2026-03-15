import { afterEach, describe, expect, it, mock } from "bun:test";
import { fetchIceServers } from "./turn-credentials.ts";

const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478?transport=udp" },
];

describe("fetchIceServers", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns TURN ice servers from the signaling endpoint", async () => {
    const turnServers = [
      { urls: "stun:stun.cloudflare.com:3478" },
      {
        urls: "turn:turn.cloudflare.com:3478?transport=udp",
        username: "user123",
        credential: "pass456",
      },
    ];
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ iceServers: turnServers }), {
          status: 200,
        }),
      ),
    ) as typeof fetch;

    const result = await fetchIceServers();
    expect(result).toEqual(turnServers);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://signal.dokuel.com/turn-credentials",
      { method: "POST" },
    );
  });

  it("falls back to default STUN servers on network error", async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error("Network error")),
    ) as typeof fetch;

    const result = await fetchIceServers();
    expect(result).toEqual(DEFAULT_ICE_SERVERS);
  });

  it("falls back to default STUN servers on non-ok response", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("error", { status: 502 })),
    ) as typeof fetch;

    const result = await fetchIceServers();
    expect(result).toEqual(DEFAULT_ICE_SERVERS);
  });

  it("falls back to default STUN servers when iceServers array is empty", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ iceServers: [] }), { status: 200 }),
      ),
    ) as typeof fetch;

    const result = await fetchIceServers();
    expect(result).toEqual(DEFAULT_ICE_SERVERS);
  });
});
