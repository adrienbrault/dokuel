import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness";
import { Doc, encodeStateAsUpdate } from "yjs";
import type { Difficulty } from "../lib/types.ts";
import {
  createFakeConnections,
  type FakeConnection,
} from "./mp-connection.fake.ts";
import type { OpenConnection } from "./mp-connection.ts";
import { createRoom, type Room } from "./mp-room.ts";
import { createRoomSession, type RoomSession } from "./mp-session.ts";

const ROOM_ID = "test-room";
// A fixed instant well past the forfeit trust window, so a session that
// never moves the clock reads "we have been present all along".
const T0 = 10_000_000;
const HIDE_DEBOUNCE_MS = 15_000;

/**
 * A scheduler the test drives by hand. `now` and the timer queue are
 * separate on purpose: a wall clock can step backwards between a timer
 * being armed and firing, and the session's wake loop has to survive it.
 */
function createClock() {
  let current = T0;
  let nextId = 1;
  const pending = new Map<number, { at: number; fn: () => void }>();

  function due(): [number, { at: number; fn: () => void }] | null {
    let earliest: [number, { at: number; fn: () => void }] | null = null;
    for (const entry of pending) {
      if (!earliest || entry[1].at < earliest[1].at) earliest = entry;
    }
    return earliest;
  }

  return {
    now: () => current,
    setNow(instant: number) {
      current = instant;
    },
    timers: {
      setTimeout(fn: () => void, ms: number) {
        const id = nextId++;
        pending.set(id, { at: current + ms, fn });
        return id as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimeout(handle: ReturnType<typeof setTimeout>) {
        pending.delete(handle as unknown as number);
      },
    },
    /** Move `now` forward, firing every timer whose deadline it passes. */
    advance(ms: number) {
      const target = current + ms;
      for (;;) {
        const next = due();
        if (!next || next[1].at > target) break;
        pending.delete(next[0]);
        current = next[1].at;
        next[1].fn();
      }
      current = target;
    },
    /** Fire the earliest pending timer without moving `now`. */
    fireEarliest() {
      const next = due();
      if (!next) throw new Error("no pending timer");
      pending.delete(next[0]);
      next[1].fn();
    },
    pendingCount: () => pending.size,
  };
}

/** Settle the open + whenSynced microtask chain. */
async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

/**
 * Play the opponent with a real Room over the session's own doc, so
 * nothing about seating or claiming is restated here. Its room id
 * differs from ours because every client keeps its own local snapshot
 * and jsdom hands them all one localStorage.
 */
function seatOpponent(doc: Doc, playerId: string, playerName: string): Room {
  const peer = createRoom({
    doc,
    roomId: `peer-of-${ROOM_ID}`,
    playerId,
    playerName: () => playerName,
    initialDifficulty: null,
    now: () => T0,
  });
  peer.apply({ type: "local-sync-complete", now: T0 });
  return peer;
}

let connections: ReturnType<typeof createFakeConnections>;
let clock: ReturnType<typeof createClock>;
let sessions: RoomSession[];

beforeEach(() => {
  localStorage.clear();
  connections = createFakeConnections();
  clock = createClock();
  sessions = [];
});

afterEach(() => {
  // close() is idempotent enough to call on an already-closed session,
  // and a session left open keeps observing a doc across tests.
  for (const session of sessions) session.close();
});

function open(
  overrides: {
    roomId?: string;
    difficulty?: Difficulty | null;
    playerName?: () => string;
    openConnection?: OpenConnection;
  } = {},
): RoomSession {
  const session = createRoomSession({
    roomId: overrides.roomId ?? ROOM_ID,
    playerId: "p1",
    playerName: overrides.playerName ?? (() => "Alice"),
    initialDifficulty:
      overrides.difficulty === undefined ? "easy" : overrides.difficulty,
    openConnection: overrides.openConnection ?? connections.open,
    now: clock.now,
    timers: clock.timers,
  });
  sessions.push(session);
  return session;
}

/** The transport the session built, once it exists. */
function transport(): FakeConnection {
  const last = connections.last;
  if (!last) throw new Error("no connection was opened");
  return last;
}

/** A session with a started game and an opponent seated. */
async function openStartedGame() {
  const session = open();
  await flush();
  const peer = seatOpponent(transport().doc, "p2", "Bob");
  peer.start();
  return { session, peer, doc: transport().doc };
}

describe("opening", () => {
  it("opens a connection for its room and projects the Room over its doc", async () => {
    const session = open();
    expect(session.snapshot().roomState).toBeNull();
    expect(session.snapshot().connected).toBe(false);

    await flush();

    expect(transport().roomId).toBe(ROOM_ID);
    expect(session.snapshot().roomState?.players).toHaveLength(1);
    expect(session.snapshot().roomState?.difficulty).toBe("easy");
  });

  it("notifies subscribers as the room moves", async () => {
    const session = open();
    let notifications = 0;
    session.subscribe(() => {
      notifications++;
    });

    await flush();

    expect(notifications).toBeGreaterThan(0);
    expect(session.snapshot().roomState).not.toBeNull();
  });

  it("keeps its snapshot identity while nothing changed", async () => {
    // The Yjs observer fires on every keystroke's progress write, and a
    // fresh object each time would re-render the whole game tree.
    const session = open();
    await flush();
    const before = session.snapshot();

    expect(session.snapshot()).toBe(before);
  });

  it("reports the transport's connection status", async () => {
    const session = open();
    await flush();
    expect(session.snapshot().connected).toBe(false);

    transport().emitStatus(true);

    expect(session.snapshot().connected).toBe(true);
  });

  it("records a transport drop as an absence the Room can trust", async () => {
    // Losing signaling is the other way we go away, alongside releasing
    // the transport for a hidden tab. A forfeit claim landing afterwards
    // is about a real absence and must be honoured.
    const { session, peer } = await openStartedGame();

    transport().emitStatus(false);
    peer.claimForfeit({ hasOtherPeer: false });

    expect(session.snapshot().gameOver).toEqual({
      winnerId: "p2",
      winnerName: "Bob",
    });
  });

  it("recomputes presence when the transport's peer set changes", async () => {
    const { session } = await openStartedGame();
    expect(session.snapshot().opponentDisconnected).toBe(false);

    transport().emitPresence();

    expect(session.snapshot().opponentDisconnected).toBe(true);
  });

  it("tears the transport down on close", async () => {
    const session = open();
    await flush();

    session.close();

    expect(transport().closed).toBe(true);
  });

  it("abandons an open it no longer wants", async () => {
    // y-webrtc keys its room registry globally by name: a transport
    // built for a room nobody is in claims the slot the live one needs.
    const session = open();
    session.close();

    await flush();

    expect(connections.all).toHaveLength(0);
  });

  it("closes a connection that finishes opening after close", async () => {
    // Belt and braces behind the abort: an adapter that ignored the
    // signal and resolved anyway must still leave nothing running.
    const session = open({
      openConnection: (roomId) => connections.open(roomId),
    });
    session.close();

    await flush();

    expect(transport().closed).toBe(true);
  });
});

describe("commands", () => {
  it("routes each command through to the room", async () => {
    const { session, doc } = await openStartedGame();

    session.setDifficulty("hard");
    session.setAssistLevel("paper");
    session.progress(7, 91);
    const solution = session.snapshot().solution as string;
    session.complete(solution);

    const state = session.snapshot().roomState;
    expect(state?.difficulty).toBe("hard");
    expect(state?.assistLevel).toBe("paper");
    expect(session.snapshot().gameOver?.winnerId).toBe("p1");
    expect(doc.getMap("players").size).toBe(2);
  });

  it("starts and rematches the room's game", async () => {
    const session = open();
    await flush();
    seatOpponent(transport().doc, "p2", "Bob");

    session.start();
    expect(session.snapshot().roomState?.gameNumber).toBe(1);

    session.rematch();
    expect(session.snapshot().roomState?.gameNumber).toBe(2);
  });

  it("publishes a rename to the room and to presence", async () => {
    // Presence carries the name too, and that lives on the Connection —
    // a rename that only reached the room would leave the opponent
    // looking at the old one.
    const session = open();
    await flush();

    session.updateName("Alicia");

    expect(session.snapshot().roomState?.players[0]?.name).toBe("Alicia");
    expect(transport().awareness.getLocalState()?.user).toEqual({
      id: "p1",
      name: "Alicia",
    });
  });

  it("reads presence at claim time rather than trusting the countdown", async () => {
    // The forfeit countdown was armed from stale state; if the opponent
    // reconnected in the meantime, taking the win would steamroll a
    // player who just came back.
    const { session } = await openStartedGame();
    // A peer's presence arrives as an awareness update from its own
    // client, which is what `hasOtherPeer` looks for — announcing on our
    // own connection would only rewrite our own entry.
    const peerDoc = new Doc();
    const peerAwareness = new Awareness(peerDoc);
    peerAwareness.setLocalStateField("user", { id: "p2", name: "Bob" });
    applyAwarenessUpdate(
      transport().awareness,
      encodeAwarenessUpdate(peerAwareness, [peerDoc.clientID]),
      "test",
    );

    session.claimForfeit();
    peerAwareness.destroy();

    expect(session.snapshot().roomState?.winnerId).toBeNull();
  });

  it("claims the forfeit when no other peer is reachable", async () => {
    const { session } = await openStartedGame();

    session.claimForfeit();

    expect(session.snapshot().roomState?.winnerId).toBe("p1");
  });
});

describe("backgrounded tab", () => {
  it("mirrors the room to local storage the moment the tab hides", async () => {
    // Local persistence is async and a backgrounded tab is not always
    // given time to flush it before the process is killed.
    const { session } = await openStartedGame();
    expect(localStorage.getItem(`dokuel_mp_snap_${ROOM_ID}`)).toBeNull();

    session.visibilityChanged(true);

    const raw = localStorage.getItem(`dokuel_mp_snap_${ROOM_ID}`);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).players).toHaveLength(2);
  });

  it("mirrors the room on pagehide", async () => {
    const { session } = await openStartedGame();

    session.pageHidden();

    expect(localStorage.getItem(`dokuel_mp_snap_${ROOM_ID}`)).not.toBeNull();
  });

  it("holds the transport for the debounce window before releasing it", async () => {
    const session = open();
    await flush();
    transport().emitStatus(true);

    session.visibilityChanged(true);
    clock.advance(HIDE_DEBOUNCE_MS - 1);
    expect(transport().disconnectCount).toBe(0);

    clock.advance(1);

    expect(transport().disconnectCount).toBe(1);
    expect(transport().connected).toBe(false);
  });

  it("keeps the transport when the tab returns before the debounce", async () => {
    const session = open();
    await flush();
    transport().emitStatus(true);

    session.visibilityChanged(true);
    clock.advance(5_000);
    session.visibilityChanged(false);
    clock.advance(30_000);

    expect(transport().disconnectCount).toBe(0);
  });

  it("reconnects and re-announces when the tab returns after a release", async () => {
    const session = open();
    await flush();
    transport().emitStatus(true);
    transport().connectCount = 0;

    session.visibilityChanged(true);
    clock.advance(HIDE_DEBOUNCE_MS);
    // The release wiped our awareness entry — from the opponent's point
    // of view we vanished.
    expect(transport().awareness.getLocalState()).toBeNull();

    session.visibilityChanged(false);

    expect(transport().connectCount).toBe(1);
    expect(transport().connected).toBe(true);
    // Without a working re-announce the opponent keeps seeing us as
    // gone and is offered a forfeit win while we are actively playing.
    expect(transport().awareness.getLocalState()?.user).toEqual({
      id: "p1",
      name: "Alice",
    });
  });

  it("remembers a tab that hid before the connection was open", async () => {
    // Opening is async, and the tab can go away inside that window.
    // The session tracks `hidden` itself rather than reading it back
    // off a DOM it cannot see, so the debounce it armed against no
    // transport still releases the one that arrives.
    const session = open();
    session.visibilityChanged(true);

    await flush();
    clock.advance(HIDE_DEBOUNCE_MS);

    expect(transport().disconnectCount).toBe(1);
  });

  it("drops a pending release when the session closes", async () => {
    // The debounce outlives nothing: a timer left armed past close
    // would fire against a torn-down Connection and a Room that has
    // stopped observing its doc.
    const session = open();
    await flush();
    session.visibilityChanged(true);
    expect(clock.pendingCount()).toBe(1);

    session.close();
    clock.advance(HIDE_DEBOUNCE_MS * 2);

    expect(clock.pendingCount()).toBe(0);
    expect(transport().disconnectCount).toBe(0);
  });

  it("does not blame the opponent while we are the one who went away", async () => {
    const { session } = await openStartedGame();

    session.visibilityChanged(true);
    transport().emitPresence();

    expect(session.snapshot().opponentDisconnected).toBe(false);
  });

  it("accepts a forfeit claim made while we really were away", async () => {
    // Releasing the transport for a backgrounded tab is an absence the
    // Room must record, or the opponent's honest claim looks fabricated.
    const { session, peer } = await openStartedGame();

    session.visibilityChanged(true);
    clock.advance(HIDE_DEBOUNCE_MS);
    session.visibilityChanged(false);
    peer.claimForfeit({ hasOtherPeer: false });

    expect(session.snapshot().gameOver).toEqual({
      winnerId: "p2",
      winnerName: "Bob",
    });
  });

  it("ignores a forfeit claim made while we never left", async () => {
    const { session, peer } = await openStartedGame();

    peer.claimForfeit({ hasOtherPeer: false });

    expect(session.snapshot().gameOver).toBeNull();
  });
});

describe("hydration", () => {
  function seedSnapshot() {
    localStorage.setItem(
      `dokuel_mp_snap_${ROOM_ID}`,
      JSON.stringify({
        gameNumber: 4,
        puzzle: ".".repeat(81),
        solution: null,
        status: "playing",
        difficulty: "hard",
        assistLevel: "standard",
        hostId: "p1",
        players: [
          {
            id: "p1",
            name: "Alice",
            color: "#3B82F6",
            cellsRemaining: 30,
            completionPercent: 63,
          },
          {
            id: "p2",
            name: "Bob",
            color: "#EF4444",
            cellsRemaining: 25,
            completionPercent: 69,
          },
        ],
        winnerId: null,
        winnerName: null,
        savedAt: Date.now(),
      }),
    );
  }

  it("applies the stored snapshot when local persistence has no game", async () => {
    seedSnapshot();
    const session = open({ difficulty: null });
    await flush();
    expect(session.snapshot().hasStartedGame).toBe(false);

    clock.advance(3_000);

    expect(session.snapshot().hasStartedGame).toBe(true);
    expect(session.snapshot().puzzle).toBe(".".repeat(81));
    expect(session.snapshot().roomState?.gameNumber).toBe(4);
  });

  it("keeps waking until the Room is waiting on nothing", async () => {
    // NTP corrections and VM restores move the wall clock backwards. A
    // timer timed against a clock that went back fires early, the Room
    // drops the tick, and a wake loop that did not re-arm would strand
    // the snapshot for good — leaving the player without a seat.
    seedSnapshot();
    const session = open({ difficulty: null });
    await flush();

    clock.setNow(T0 - 5_000);
    clock.fireEarliest();
    expect(session.snapshot().hasStartedGame).toBe(false);

    clock.advance(10_000);

    expect(session.snapshot().hasStartedGame).toBe(true);
    expect(session.snapshot().roomState?.gameNumber).toBe(4);
    expect(clock.pendingCount()).toBe(0);
  });

  it("leaves the stored snapshot alone when persistence already had a game", async () => {
    // Local persistence loads into the doc after the doc already exists.
    // Writing before it settles races the restore, and under flaky IDB
    // flushes the room resolves back to an empty lobby over several
    // reloads — wiping the game in progress.
    seedSnapshot();
    const restored = new Doc();
    const host = seatOpponent(restored, "p1", "Alice");
    seatOpponent(restored, "p2", "Bob");
    host.start();
    const restoredRoom = restored.getMap("room");
    const puzzle = restoredRoom.get("puzzle") as string;
    const solution = restoredRoom.get("solution") as string;
    const gameNumber = restoredRoom.get("gameNumber") as number;
    connections.persistedUpdate = encodeStateAsUpdate(restored);

    const session = open({ difficulty: null });
    await flush();

    expect(clock.pendingCount()).toBe(0);
    expect(session.snapshot().hasStartedGame).toBe(true);
    expect(session.snapshot().puzzle).toBe(puzzle);
    expect(session.snapshot().solution).toBe(solution);
    expect(session.snapshot().roomState?.gameNumber).toBe(gameNumber);
    expect(session.snapshot().roomState?.status).toBe("playing");
    expect(session.snapshot().roomState?.players).toHaveLength(2);
    // The stored snapshot never got a look in.
    expect(session.snapshot().roomState?.difficulty).not.toBe("hard");
  });
});
