import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchTurnIceServers,
  resetTurnCredentialsCache,
  TURN_CREDENTIALS_URL,
} from "./turn.ts";

const CF_ICE_SERVERS = [
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
  resetTurnCredentialsCache();
});

describe("fetchTurnIceServers", () => {
  it("returns the iceServers minted by the signaling worker", async () => {
    const fetchMock = stubFetchOk({ iceServers: CF_ICE_SERVERS });

    const servers = await fetchTurnIceServers();

    expect(servers).toEqual(CF_ICE_SERVERS);
    expect(fetchMock).toHaveBeenCalledWith(
      TURN_CREDENTIALS_URL,
      expect.anything(),
    );
  });

  it("returns null when the worker has no TURN key configured (404)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("TURN not configured", {
          status: 404,
        }),
      ),
    );

    expect(await fetchTurnIceServers()).toBeNull();
  });

  it("returns null when the request fails or times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    expect(await fetchTurnIceServers()).toBeNull();
  });

  it("returns null when the body is not an iceServers array", async () => {
    stubFetchOk({ error: "unexpected shape" });

    expect(await fetchTurnIceServers()).toBeNull();
  });

  it("reuses minted credentials across calls instead of refetching", async () => {
    const fetchMock = stubFetchOk({ iceServers: CF_ICE_SERVERS });

    await fetchTurnIceServers();
    const second = await fetchTurnIceServers();

    expect(second).toEqual(CF_ICE_SERVERS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries after a failure instead of caching the null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    expect(await fetchTurnIceServers()).toBeNull();

    const fetchMock = stubFetchOk({ iceServers: CF_ICE_SERVERS });

    expect(await fetchTurnIceServers()).toEqual(CF_ICE_SERVERS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
