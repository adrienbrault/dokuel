import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTurnIceServers, TURN_CREDENTIALS_URL } from "./turn.ts";

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
});
