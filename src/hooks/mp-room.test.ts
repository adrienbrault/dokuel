import { beforeEach, describe, expect, it } from "vitest";
import { applyUpdate, Doc, encodeStateAsUpdate, Map as YMap } from "yjs";
import { generatePuzzleWithSolution } from "../lib/sudoku.ts";
import type { Difficulty } from "../lib/types.ts";
import { createRoom } from "./mp-room.ts";
import {
  claimWinner,
  createRoomFromDoc,
  initializeRoom,
  joinRoom,
  startGame,
  updateProgress,
} from "./p2p-room.ts";

const ROOM_ID = "test-room";

// A fixed instant well past the forfeit trust window, so a test that
// never touches the clock reads "we have been present all along".
const T0 = 10_000_000;

function setup(initialDifficulty: Difficulty | null = null) {
  const doc = new Doc();
  const p2p = createRoomFromDoc(doc, ROOM_ID);
  let clock = T0;
  const room = createRoom({
    doc,
    roomId: ROOM_ID,
    playerId: "p1",
    playerName: () => "Alice",
    initialDifficulty,
    now: () => clock,
  });
  return {
    doc,
    p2p,
    room,
    tickTo(instant: number) {
      clock = instant;
    },
  };
}

/** A room with two seated players and a game underway. */
function setupStartedGame() {
  const ctx = setup();
  initializeRoom(ctx.p2p, "p1", "easy");
  joinRoom(ctx.p2p, "p1", "Alice");
  joinRoom(ctx.p2p, "p2", "Bob");
  startGame(ctx.p2p);
  const solution = ctx.doc.getMap("room").get("solution") as string;
  return { ...ctx, solution };
}

beforeEach(() => {
  localStorage.clear();
});

describe("projection", () => {
  it("keeps its identity across no-op doc fires", () => {
    // The observer fires for every transaction — including our own
    // keystrokes' progress writes and same-value sets — and rebuilding
    // the projection each time re-rendered the whole game tree per
    // keystroke on both sides.
    const { doc, room } = setupStartedGame();
    const before = room.snapshot();
    expect(before.roomState).not.toBeNull();

    doc.transact(() => {
      doc.getMap("room").set("difficulty", "easy");
    });

    expect(room.snapshot()).toBe(before);
  });

  it("latches hasStartedGame on the first started game", () => {
    const { p2p, room } = setup();
    initializeRoom(p2p, "p1", "easy");
    joinRoom(p2p, "p1", "Alice");
    joinRoom(p2p, "p2", "Bob");
    expect(room.snapshot().hasStartedGame).toBe(false);

    startGame(p2p);

    expect(room.snapshot().hasStartedGame).toBe(true);
  });

  it("adopts the puzzle and solution of a started game", () => {
    const { doc, room } = setupStartedGame();

    expect(room.snapshot().puzzle).toBe(doc.getMap("room").get("puzzle"));
    expect(room.snapshot().solution).toBe(doc.getMap("room").get("solution"));
  });

  it("does not adopt a malformed remote puzzle", () => {
    // The CRDT is peer-writable: a malicious or buggy peer can set
    // puzzle/solution to anything. Adopting garbage renders a NaN board
    // and bricks completion — keep the last valid game instead.
    const { doc, room } = setupStartedGame();
    const goodPuzzle = room.snapshot().puzzle;

    doc.transact(() => {
      const roomMap = doc.getMap("room");
      roomMap.set("gameNumber", 99);
      roomMap.set("puzzle", "lol-not-a-board");
      roomMap.set("solution", "also-not-a-board");
    });

    expect(room.snapshot().puzzle).toBe(goodPuzzle);
  });

  it("adopts the merged puzzle after a concurrent start collides on gameNumber", () => {
    // Both players tapping Start (or Rematch) inside sync latency write
    // the SAME gameNumber with different puzzles; Yjs LWW keeps one. The
    // losing writer already latched that number from its own local
    // write — without a content resync it would keep rendering its own
    // board while the room holds the other puzzle, and its completion
    // could never validate: a soft-locked game.
    const { doc, room } = setupStartedGame();
    const other = generatePuzzleWithSolution("easy");

    doc.transact(() => {
      const roomMap = doc.getMap("room");
      roomMap.set("puzzle", other.puzzle);
      roomMap.set("solution", other.solution);
    });

    expect(room.snapshot().puzzle).toBe(other.puzzle);
    expect(room.snapshot().solution).toBe(other.solution);
  });

  it("projects the opponent's progress and keeps its identity when it stalls", () => {
    const { p2p, room } = setupStartedGame();

    updateProgress(p2p, "p2", 40, 50);
    const progress = room.snapshot().opponentProgress;
    expect(progress).toEqual({ cellsRemaining: 40, completionPercent: 50 });

    updateProgress(p2p, "p1", 30, 60);

    expect(room.snapshot().opponentProgress).toBe(progress);
  });
});

describe("seats", () => {
  it("flags roomFull for a player with no seat in a full room", () => {
    const { p2p, room } = setup();
    initializeRoom(p2p, "p2", "medium");
    joinRoom(p2p, "p2", "Bob");
    joinRoom(p2p, "p3", "Carol");

    expect(room.snapshot().roomFull).toBe(true);
  });

  it("does not flag roomFull for a seated player", () => {
    const { p2p, room } = setup();
    initializeRoom(p2p, "p1", "medium");
    joinRoom(p2p, "p1", "Alice");
    joinRoom(p2p, "p2", "Bob");

    expect(room.snapshot().roomFull).toBe(false);
  });

  it("evicts itself from the players map after a concurrent-join overflow", () => {
    // A concurrent-join merge can leave 3 entries even though joinRoom
    // capped locally. The overflow player (us, by deterministic seat
    // sort) must delete its own entry — otherwise the two seated players
    // stare at a lobby whose Start never enables.
    const { doc, p2p, room } = setup();
    initializeRoom(p2p, "a1", "medium");
    joinRoom(p2p, "p1", "Alice");

    // The merged remote state: two players whose joinOrder/id sort ahead
    // of ours ("a1"/"a2" < "p1" at joinOrder 0).
    doc.transact(() => {
      const players = doc.getMap("players");
      for (const id of ["a1", "a2"]) {
        const pm = new YMap<unknown>();
        pm.set("name", id);
        pm.set("color", "blue");
        pm.set("cellsRemaining", 81);
        pm.set("completionPercent", 0);
        pm.set("joinOrder", 0);
        players.set(id, pm);
      }
    });

    expect(room.snapshot().roomFull).toBe(true);
    expect(doc.getMap("players").has("p1")).toBe(false);
    expect(doc.getMap("players").size).toBe(2);
  });
});

describe("presence", () => {
  it("flags the opponent as disconnected once their presence drops", () => {
    const { room } = setupStartedGame();

    room.apply({
      type: "presence-changed",
      hasOtherPeer: false,
      tabHidden: false,
    });

    expect(room.snapshot().opponentDisconnected).toBe(true);
  });

  it("clears the flag when the opponent comes back", () => {
    const { room } = setupStartedGame();
    room.apply({
      type: "presence-changed",
      hasOtherPeer: false,
      tabHidden: false,
    });

    room.apply({
      type: "presence-changed",
      hasOtherPeer: true,
      tabHidden: false,
    });

    expect(room.snapshot().opponentDisconnected).toBe(false);
  });

  it("does not blame the opponent while we are the one who went away", () => {
    // We release our own transport for a backgrounded tab, which clears
    // our awareness — from here it looks exactly like the opponent
    // vanishing.
    const { room } = setupStartedGame();

    room.apply({
      type: "presence-changed",
      hasOtherPeer: false,
      tabHidden: true,
    });

    expect(room.snapshot().opponentDisconnected).toBe(false);
  });

  it("stays quiet before a second player has ever joined", () => {
    const { p2p, room } = setup();
    initializeRoom(p2p, "p1", "easy");
    joinRoom(p2p, "p1", "Alice");

    room.apply({
      type: "presence-changed",
      hasOtherPeer: false,
      tabHidden: false,
    });

    expect(room.snapshot().opponentDisconnected).toBe(false);
  });
});

describe("win claims", () => {
  it("accepts a remote claim whose board matches the solution", () => {
    const { p2p, room, solution } = setupStartedGame();

    claimWinner(p2p, "p2", "Bob", solution);

    expect(room.snapshot().gameOver).toEqual({
      winnerId: "p2",
      winnerName: "Bob",
    });
  });

  it("ignores a remote solved-claim whose board is forged", () => {
    // A peer can write any winnerId it likes into the CRDT; the claim
    // only counts here if the board it ships actually solves the puzzle.
    const { p2p, room } = setupStartedGame();

    claimWinner(p2p, "p2", "Bob", "1".repeat(81));

    expect(room.snapshot().gameOver).toBeNull();
  });

  it("treats an empty-string winner board as forged, not forfeit", () => {
    // "" is a solved-claim with no board — the original one-liner cheat.
    // If it collapsed to null it would be judged down the forfeit path.
    const { p2p, room } = setupStartedGame();

    claimWinner(p2p, "p2", "Bob", "");

    expect(room.snapshot().gameOver).toBeNull();
  });

  it("ignores a forfeit claim received while we were continuously present", () => {
    // A forfeit claim asserts that WE left. This client never went away,
    // so the claim is fabricated (the one-liner devtools cheat).
    const { p2p, room } = setupStartedGame();

    claimWinner(p2p, "p2", "Bob", null);

    expect(room.snapshot().gameOver).toBeNull();
  });

  it("ignores a claim whose board is not even a board", () => {
    // A peer can write anything into winnerBoard. A number is not a
    // solved board and not the absence of one either, so it must not
    // be read as a forfeit claim — which our own absence record would
    // then back, handing the room to a cheat.
    const { doc, room } = setupStartedGame();
    room.apply({ type: "connectivity-changed", connected: false, now: T0 });

    doc.transact(() => {
      const roomMap = doc.getMap("room");
      roomMap.set("winnerId", "p2");
      roomMap.set("winnerName", "Bob");
      roomMap.set("winnerBoard", 42);
      roomMap.set("status", "finished");
    });

    expect(room.snapshot().gameOver).toBeNull();
  });

  it("ignores a forfeit claim on a clock that only just started", () => {
    // "Never been away" is not "was away at instant zero". The binding
    // feeds the Room a monotonic clock that starts near zero at page
    // load, so an absence record initialised to 0 would read as an
    // absence that just ended and honour a fabricated forfeit for the
    // first two minutes of every session.
    const { p2p, room, tickTo } = setupStartedGame();
    tickTo(1_000);

    claimWinner(p2p, "p2", "Bob", null);

    expect(room.snapshot().gameOver).toBeNull();
  });

  it("accepts a forfeit claim that our own absence record backs", () => {
    const { p2p, room, tickTo } = setupStartedGame();
    room.apply({ type: "connectivity-changed", connected: false, now: T0 });
    room.apply({ type: "visibility-changed", hidden: false, now: T0 + 1_000 });
    tickTo(T0 + 2_000);

    claimWinner(p2p, "p2", "Bob", null);

    expect(room.snapshot().gameOver).toEqual({
      winnerId: "p2",
      winnerName: "Bob",
    });
  });

  it("stops honoring a forfeit claim once the trust window has lapsed", () => {
    // The window covers the opponent's countdown plus sync latency. A
    // claim landing minutes after we came back is not about that
    // absence.
    const { p2p, room, tickTo } = setupStartedGame();
    room.apply({ type: "connectivity-changed", connected: false, now: T0 });
    room.apply({ type: "visibility-changed", hidden: false, now: T0 + 1_000 });
    tickTo(T0 + 1_000 + 130_000);

    claimWinner(p2p, "p2", "Bob", null);

    expect(room.snapshot().gameOver).toBeNull();
  });

  it("honors a forfeit claim landing while we are still away", () => {
    const { p2p, room } = setupStartedGame();
    room.apply({ type: "connectivity-changed", connected: false, now: T0 });

    claimWinner(p2p, "p2", "Bob", null);

    expect(room.snapshot().gameOver).toEqual({
      winnerId: "p2",
      winnerName: "Bob",
    });
  });

  it("refuses to claim with a board that does not solve the puzzle", () => {
    const { doc, room } = setupStartedGame();

    room.complete("1".repeat(81));

    expect(doc.getMap("room").get("winnerId")).toBeNull();
  });

  it("claims the win when the submitted board matches the solution", () => {
    const { doc, room, solution } = setupStartedGame();

    room.complete(solution);

    expect(doc.getMap("room").get("winnerId")).toBe("p1");
    expect(doc.getMap("room").get("winnerBoard")).toBe(solution);
  });

  it("lets the real winner claim over a forged claim", () => {
    const { doc, p2p, room, solution } = setupStartedGame();
    claimWinner(p2p, "p2", "Bob", "1".repeat(81));

    room.complete(solution);

    expect(doc.getMap("room").get("winnerId")).toBe("p1");
  });

  it("records a forfeit win with no board", () => {
    const { doc, room } = setupStartedGame();

    room.claimForfeit({ hasOtherPeer: false });

    expect(doc.getMap("room").get("winnerId")).toBe("p1");
    expect(doc.getMap("room").get("winnerBoard")).toBeNull();
  });

  it("refuses a forfeit claim while the opponent is present", () => {
    // The countdown races the opponent's reconnect: if their presence
    // reappeared by the time the claim fires, taking the forfeit would
    // steamroll a player who just came back.
    const { doc, room } = setupStartedGame();

    room.claimForfeit({ hasOtherPeer: true });

    expect(doc.getMap("room").get("winnerId")).toBeNull();
  });

  it("ignores a reachable peer that never took a seat", () => {
    // A stray awareness entry — our own second tab, a peer still
    // syncing — is not an opponent. Only a seated player can be present
    // enough to block our claim, which is why the Room folds its own
    // player list into what the Connection reports.
    const { doc, p2p, room } = setup();
    initializeRoom(p2p, "p1", "easy");
    joinRoom(p2p, "p1", "Alice");
    startGame(p2p);

    room.claimForfeit({ hasOtherPeer: true });

    expect(doc.getMap("room").get("winnerId")).toBe("p1");
  });

  it("drops the stored snapshot once the game is over", () => {
    // The room is finished; a resume of it would flash a decided game.
    const { p2p, room, solution } = setupStartedGame();
    localStorage.setItem(`dokuel_mp_snap_${ROOM_ID}`, "{}");

    claimWinner(p2p, "p2", "Bob", solution);

    expect(room.snapshot().gameOver).not.toBeNull();
    expect(localStorage.getItem(`dokuel_mp_snap_${ROOM_ID}`)).toBeNull();
  });
});

describe("setup", () => {
  it("lets the creator write its chosen difficulty and claim host", () => {
    const { doc, room } = setup("expert");

    room.apply({ type: "local-sync-complete", now: T0 });

    expect(doc.getMap("room").get("difficulty")).toBe("expert");
    expect(doc.getMap("room").get("hostId")).toBe("p1");
    expect(room.snapshot().roomState?.players).toHaveLength(1);
  });

  it("lets a joiner write nothing but its own seat", () => {
    // Initializing both peers concurrently would race for hostId: each
    // fresh doc sees "no host yet" before sync, both write, and LWW can
    // hand the room to the wrong peer. Only the creator initializes.
    const { doc, room } = setup(null);

    room.apply({ type: "local-sync-complete", now: T0 });

    const roomMap = doc.getMap("room");
    expect(roomMap.get("status")).toBeUndefined();
    expect(roomMap.get("hostId")).toBeUndefined();
    expect(doc.getMap("players").has("p1")).toBe(true);
  });

  it("flags roomFull when a full room refuses our seat", () => {
    // joinRoom no-ops rather than overflowing, which writes nothing and
    // fires no observer — the projection still has to move.
    const { p2p, room } = setup(null);
    initializeRoom(p2p, "p2", "medium");
    joinRoom(p2p, "p2", "Bob");
    joinRoom(p2p, "p3", "Carol");

    room.apply({ type: "local-sync-complete", now: T0 });

    expect(room.snapshot().roomFull).toBe(true);
    expect(room.snapshot().roomState?.players).toHaveLength(2);
  });
});

describe("hydration", () => {
  const SNAPSHOT = {
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
  };

  function seedSnapshot() {
    localStorage.setItem(
      `dokuel_mp_snap_${ROOM_ID}`,
      JSON.stringify({ ...SNAPSHOT, savedAt: Date.now() }),
    );
  }

  it("applies the snapshot once the grace window lapses", () => {
    seedSnapshot();
    const { room } = setup(null);
    room.apply({ type: "local-sync-complete", now: T0 });
    // The deadline is the Room's to define; the binding only schedules
    // a timer for whatever instant it names.
    expect(room.nextWakeAt()).toBe(T0 + 3_000);
    expect(room.snapshot().hasStartedGame).toBe(false);

    room.apply({ type: "tick", now: room.nextWakeAt() ?? 0 });

    expect(room.snapshot().hasStartedGame).toBe(true);
    expect(room.snapshot().puzzle).toBe(".".repeat(81));
    expect(room.snapshot().roomState?.gameNumber).toBe(4);
    expect(room.snapshot().roomState?.difficulty).toBe("hard");
  });

  it("keeps asking for a wake-up after a tick that came too early", () => {
    // The Room drops an early tick, so it must still be naming an
    // instant afterwards — the binding re-arms from nextWakeAt() and a
    // Room that went quiet here would strand the snapshot forever,
    // leaving the player without a seat.
    seedSnapshot();
    const { room } = setup(null);
    room.apply({ type: "local-sync-complete", now: T0 });

    room.apply({ type: "tick", now: T0 + 1_000 });

    expect(room.snapshot().hasStartedGame).toBe(false);
    expect(room.nextWakeAt()).toBe(T0 + 3_000);
  });

  it("prefers live peer state that arrives during the grace window", () => {
    // Hydrating a recent snapshot into a FRESH doc makes every key
    // causally concurrent with the live room — per-key LWW can then roll
    // a finished game back for both peers.
    seedSnapshot();
    const { doc, room } = setup(null);
    // Make our writes win LWW ties so a premature hydration is
    // deterministically visible instead of a clientID coin flip.
    doc.clientID = 0x7fffffff;
    room.apply({ type: "local-sync-complete", now: T0 });
    // Read before the peer update lands: once it does, the Room is
    // waiting on nothing and would name no instant at all.
    const wakeAt = room.nextWakeAt() ?? 0;

    const peer = new Doc();
    const peerRoom = createRoomFromDoc(peer, ROOM_ID);
    initializeRoom(peerRoom, "p2", "medium");
    joinRoom(peerRoom, "p2", "Bob");
    joinRoom(peerRoom, "p1", "Alice");
    for (let i = 0; i < 7; i++) startGame(peerRoom);
    applyUpdate(doc, encodeStateAsUpdate(peer));

    room.apply({ type: "tick", now: wakeAt });

    expect(room.snapshot().roomState?.gameNumber).toBe(7);
    expect(room.snapshot().roomState?.difficulty).toBe("medium");
  });

  it("does not hold setup back when the doc already has a started game", () => {
    seedSnapshot();
    const { p2p, room } = setup(null);
    initializeRoom(p2p, "p1", "medium");
    joinRoom(p2p, "p1", "Alice");
    joinRoom(p2p, "p2", "Bob");
    for (let i = 0; i < 7; i++) startGame(p2p);

    room.apply({ type: "local-sync-complete", now: T0 });

    expect(room.nextWakeAt()).toBeNull();
    expect(room.snapshot().roomState?.gameNumber).toBe(7);
    expect(room.snapshot().roomState?.difficulty).not.toBe("hard");
  });
});

describe("commands", () => {
  function countClues(puzzle: string): number {
    return puzzle.split("").filter((c) => c !== ".").length;
  }

  it("refuses to start a game the room has no opponent for", () => {
    const { doc, room } = setup("easy");
    room.apply({ type: "local-sync-complete", now: T0 });

    room.start();

    expect(room.snapshot().error?.message).toBe("Need 2 players to start");
    expect(doc.getMap("room").get("puzzle")).toBeNull();
  });

  it("re-raises an identical error so the toast can show again", () => {
    // A bare string field is Object.is-equal on the second raise, so the
    // consumer's effect never re-fires and the second tap silently does
    // nothing.
    const { room } = setup("easy");
    room.apply({ type: "local-sync-complete", now: T0 });
    room.start();
    const first = room.snapshot().error;

    room.start();

    expect(room.snapshot().error?.message).toBe(first?.message);
    expect(room.snapshot().error).not.toBe(first);
  });

  it("starts on the room's difficulty, not the creator's", () => {
    // The host may switch difficulty in the lobby after the room was
    // created; the board must follow the room.
    const { doc, p2p, room } = setup("easy");
    room.apply({ type: "local-sync-complete", now: T0 });
    joinRoom(p2p, "p2", "Bob");
    room.setDifficulty("expert");

    room.start();

    // Expert digs to a minimal puzzle (~22-28 clues) — well below the
    // easy band (36-45).
    const puzzle = doc.getMap("room").get("puzzle") as string;
    expect(countClues(puzzle)).toBeLessThanOrEqual(28);
  });

  it("rematches on the room's difficulty too", () => {
    const { doc, p2p, room } = setup("easy");
    room.apply({ type: "local-sync-complete", now: T0 });
    joinRoom(p2p, "p2", "Bob");
    room.setDifficulty("expert");
    room.start();

    room.rematch();

    const puzzle = doc.getMap("room").get("puzzle") as string;
    expect(countClues(puzzle)).toBeLessThanOrEqual(28);
    expect(doc.getMap("room").get("gameNumber")).toBe(2);
  });

  it("mirrors the room to local storage on demand", () => {
    const { room } = setupStartedGame();

    room.persistSnapshot();

    const raw = localStorage.getItem(`dokuel_mp_snap_${ROOM_ID}`);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).players).toHaveLength(2);
  });

  it("renames the player in the room", () => {
    const { doc, room } = setup("easy");
    room.apply({ type: "local-sync-complete", now: T0 });

    room.updateName("Alicia");

    const players = doc.getMap("players");
    expect((players.get("p1") as YMap<unknown>).get("name")).toBe("Alicia");
  });

  it("publishes our own progress for the opponent to read", () => {
    const { doc, room } = setupStartedGame();

    room.progress(12, 85);

    const p1 = doc.getMap("players").get("p1") as YMap<unknown>;
    expect(p1.get("cellsRemaining")).toBe(12);
    expect(p1.get("completionPercent")).toBe(85);
  });

  it("sets the assist level for both players", () => {
    const { doc, room } = setup("easy");
    room.apply({ type: "local-sync-complete", now: T0 });

    room.setAssistLevel("paper");

    expect(doc.getMap("room").get("assistLevel")).toBe("paper");
  });
});

describe("close", () => {
  it("stops projecting doc changes", () => {
    const { p2p, room } = setupStartedGame();
    const before = room.snapshot();

    room.close();
    startGame(p2p);

    expect(room.snapshot()).toBe(before);
  });
});
