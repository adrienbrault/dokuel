import { beforeEach, describe, expect, it } from "vitest";
import { Doc, Map as YMap } from "yjs";
import { generatePuzzleWithSolution } from "../lib/sudoku.ts";
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

function setup() {
  const doc = new Doc();
  const p2p = createRoomFromDoc(doc, ROOM_ID);
  let clock = T0;
  const room = createRoom({
    doc,
    roomId: ROOM_ID,
    playerId: "p1",
    playerName: () => "Alice",
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

    room.claimForfeit({ hasOpponent: false });

    expect(doc.getMap("room").get("winnerId")).toBe("p1");
    expect(doc.getMap("room").get("winnerBoard")).toBeNull();
  });

  it("refuses a forfeit claim while the opponent is present", () => {
    // The countdown races the opponent's reconnect: if their presence
    // reappeared by the time the claim fires, taking the forfeit would
    // steamroll a player who just came back.
    const { doc, room } = setupStartedGame();

    room.claimForfeit({ hasOpponent: true });

    expect(doc.getMap("room").get("winnerId")).toBeNull();
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

describe("close", () => {
  it("stops projecting doc changes", () => {
    const { p2p, room } = setupStartedGame();
    const before = room.snapshot();

    room.close();
    startGame(p2p);

    expect(room.snapshot()).toBe(before);
  });
});
