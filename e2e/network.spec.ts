import { expect, type Page } from "@playwright/test";
import { solvePuzzle } from "../src/lib/sudoku.ts";
import { fillCells, preparePage, readBoard, test } from "./fixtures.ts";

const forceRelay = process.env.DOKUEL_FORCE_RELAY === "1";

// These tests run against the real Worker on localhost. Only the endpoint
// and ICE servers change; Yjs, WebRTC, IndexedDB and the browser are real.
async function instrumentTransport(page: Page) {
  await page.addInitScript((relay) => {
    const Socket = window.WebSocket;
    window.WebSocket = class extends Socket {
      constructor(url: string | URL, protocols?: string | string[]) {
        const target = new URL(url);
        if (target.hostname === "signal.dokuel.com") {
          target.protocol = "ws:";
          target.host = "127.0.0.1:8787";
        }
        super(target.toString(), protocols);
      }
    };
    const peers: RTCPeerConnection[] = [];
    Object.defineProperty(window, "dokuelTestPeers", { value: peers });
    const Peer = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends Peer {
      constructor(configuration?: RTCConfiguration) {
        super({
          ...configuration,
          iceTransportPolicy: relay ? "relay" : "all",
          iceServers: relay
            ? [
                {
                  urls: "turn:127.0.0.1:3478?transport=udp",
                  username: "dokuel",
                  credential: "test-only-password",
                },
              ]
            : [],
        });
        peers.push(this);
      }
    };
  }, forceRelay);
}

async function selectedCandidateTypes(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const peers = (
      window as unknown as { dokuelTestPeers: RTCPeerConnection[] }
    ).dokuelTestPeers;
    const types: string[] = [];
    for (const peer of peers) {
      if (peer.connectionState !== "connected") continue;
      const stats = await peer.getStats();
      stats.forEach((stat) => {
        if (
          stat.type === "candidate-pair" &&
          stat.state === "succeeded" &&
          stat.nominated
        ) {
          const candidate = stats.get(stat.localCandidateId);
          if (candidate?.candidateType) types.push(candidate.candidateType);
        }
      });
    }
    return types;
  });
}

async function connectedPeerCount(page: Page) {
  return page.evaluate(() => {
    const peers = (
      window as unknown as { dokuelTestPeers: RTCPeerConnection[] }
    ).dokuelTestPeers;
    return peers.filter((peer) => peer.connectionState === "connected").length;
  });
}

test(`isolated players use ${forceRelay ? "forced TURN relay" : "direct WebRTC"} and restore after a peer interruption`, async ({
  browser,
}, testInfo) => {
  test.setTimeout(60_000);
  const hostContext = await browser.newContext({
    baseURL: "http://127.0.0.1:4173",
    serviceWorkers: "block",
  });
  const guestContext = await browser.newContext({
    baseURL: "http://127.0.0.1:4173",
    serviceWorkers: "block",
  });
  try {
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    for (const [page, id] of [
      [host, "network-host"],
      [guest, "network-guest"],
    ] as const) {
      await preparePage(page, { sudoku_player_id: id, sudoku_player_name: id });
      await instrumentTransport(page);
    }
    await host.goto("/");
    await host.getByRole("button", { name: "Challenge a friend" }).click();
    await host.getByRole("button", { name: "Easy" }).click();
    await host.getByRole("heading", { name: "Game Lobby" }).waitFor();
    await guest.goto(host.url());
    await host.getByText("network-guest", { exact: true }).waitFor();
    await expect.poll(() => connectedPeerCount(host)).toBeGreaterThan(0);
    if (forceRelay)
      await expect.poll(() => selectedCandidateTypes(host)).toContain("relay");
    await host.getByRole("button", { name: "Ready to start" }).click();
    await guest.getByRole("button", { name: "Ready to start" }).click();
    await expect(host.getByRole("grid").getByRole("button")).toHaveCount(81);
    await expect(guest.getByRole("grid").getByRole("button")).toHaveCount(81);
    const puzzle = await readBoard(host);
    expect(await readBoard(guest)).toBe(puzzle);
    const solution = solvePuzzle(puzzle);
    if (!solution) throw new Error("Shared puzzle is unsolvable");
    const firstEmpty = puzzle.indexOf(".");
    await fillCells(guest, solution, [firstEmpty]);
    const savedBoard = await readBoard(guest);
    await guest.evaluate(() => {
      const peers = (
        window as unknown as { dokuelTestPeers: RTCPeerConnection[] }
      ).dokuelTestPeers;
      for (const peer of peers) peer.close();
    });
    await guest.reload();
    await expect.poll(() => connectedPeerCount(guest)).toBeGreaterThan(0);
    await expect(guest.getByRole("grid").getByRole("button")).toHaveCount(81);
    expect(await readBoard(guest)).toBe(savedBoard);
    await testInfo.attach("transport-evidence", {
      body: JSON.stringify({
        isolatedContexts: true,
        connectedPeers: await connectedPeerCount(guest),
        restoredBoard: true,
        candidateTypes: await selectedCandidateTypes(guest),
      }),
      contentType: "application/json",
    });
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
