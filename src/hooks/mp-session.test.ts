import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeConnections } from "./mp-connection.fake.ts";
import type { Reaction } from "./mp-connection.ts";
import { type Session, startSession } from "./mp-session.ts";

const ROOM_ID = "test-room";

let connections: ReturnType<typeof createFakeConnections>;

beforeEach(() => {
  localStorage.clear();
  connections = createFakeConnections();
});

afterEach(() => {
  vi.useRealTimers();
});

async function open(): Promise<{
  session: Session;
  tick(to: number): void;
  published(): Reaction | undefined;
  publishedMask(): string | undefined;
}> {
  const connection = await connections.open(ROOM_ID);
  let clock = 0;
  const session = startSession({
    connection,
    roomId: ROOM_ID,
    playerId: "p1",
    playerName: () => "Alice",
    initialDifficulty: "easy",
    initialAssistLevel: "standard",
    now: () => clock,
    isCancelled: () => false,
    onConnected: () => {},
    onProjection: () => {},
    onOpponentSignal: () => {},
  });
  return {
    session,
    tick(to) {
      clock = to;
    },
    published() {
      const state = connections.last?.awareness.getLocalState() as
        | { signal?: { reaction?: Reaction } }
        | undefined;
      return state?.signal?.reaction;
    },
    publishedMask() {
      const state = connections.last?.awareness.getLocalState() as
        | { signal?: { mask?: string } }
        | undefined;
      return state?.signal?.mask;
    },
  };
}

describe("silhouette", () => {
  it("republishes the last silhouette after the tab comes back", async () => {
    // Releasing the transport for a backgrounded tab wipes our own
    // presence entry, silhouette included. The board has not changed
    // when the tab returns, so nothing downstream would resend it, and
    // the opponent would stare at an empty grid until our next move.
    const { session, publishedMask } = await open();
    const mask = `${"1".repeat(40)}${"0".repeat(41)}`;
    session.publishMask(mask);
    expect(publishedMask()).toBe(mask);

    connections.last?.disconnect();
    expect(publishedMask()).toBeUndefined();
    document.dispatchEvent(new Event("visibilitychange"));

    expect(publishedMask()).toBe(mask);
    session.close();
  });
});

describe("reactions", () => {
  it("publishes the emoji over the ephemeral channel", async () => {
    const { session, published } = await open();

    session.sendReaction("🔥");

    expect(published()?.emoji).toBe("🔥");
    expect(connections.last?.doc.getMap("room").has("reaction")).toBe(false);
  });

  it("refuses a second reaction within the same second", async () => {
    // Four buttons a thumb away from each other is a spam machine.
    const { session, published } = await open();
    session.sendReaction("🔥");
    const first = published();

    session.sendReaction("😅");

    expect(published()).toEqual(first);
  });

  it("lets the same emoji through again once the second is up", async () => {
    // Presence is last-write-wins state, not a queue: sending 🔥 twice
    // has to change something or the opponent sees nothing happen.
    const { session, tick, published } = await open();
    session.sendReaction("🔥");
    const first = published();

    tick(1_000);
    session.sendReaction("🔥");

    expect(published()?.emoji).toBe("🔥");
    expect(published()?.nonce).not.toBe(first?.nonce);
  });

  it("keeps the standing reaction when the silhouette is republished", async () => {
    const { session, published } = await open();
    session.sendReaction("👋");

    session.publishMask("1".repeat(81));

    expect(published()?.emoji).toBe("👋");
  });

  it("withdraws the reaction once it has had its moment", async () => {
    // Presence is state, not a message: a reaction left standing would
    // replay, buzz included, to an opponent who reloads ten minutes
    // later. The sender takes it back after it has been seen.
    vi.useFakeTimers();
    const { session, published } = await open();
    session.sendReaction("🔥");
    expect(published()?.emoji).toBe("🔥");

    await vi.advanceTimersByTimeAsync(5_000);

    expect(published()).toBeUndefined();
    session.close();
  });
});
