import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Awareness } from "y-protocols/awareness";
import { applyUpdate, Doc, encodeStateAsUpdate, Map as YMap } from "yjs";

type FakeProvider = {
  awareness: Awareness;
  connected: boolean;
  connectCount: number;
  disconnectCount: number;
  connect(): void;
  disconnect(): void;
};

const mocks = vi.hoisted(() => ({
  lastDoc: null as Doc | null,
  lastProvider: null as FakeProvider | null,
  lastIdbName: null as string | null,
  lastIdbDoc: null as Doc | null,
  idbDestroyed: false,
  // Optional seed: tests set this BEFORE renderHook to simulate
  // pre-existing IndexedDB state. The fake constructor applies it to
  // the new doc as part of whenSynced, mirroring how the real
  // y-indexeddb loads persisted updates asynchronously.
  idbSeedUpdate: null as Uint8Array | null,
}));

vi.mock("y-webrtc", async () => {
  // Awareness is the REAL y-protocols implementation — its semantics
  // (notably: setLocalStateField silently no-ops while local state is
  // null) are exactly what presence bugs hide behind, so faking it
  // would fake away the risk. Imported inside the factory because
  // vi.mock is hoisted above module imports.
  const { Awareness, removeAwarenessStates } = await import(
    "y-protocols/awareness"
  );
  class FakeWebrtcProvider implements FakeProvider {
    awareness: Awareness;
    connected = false;
    connectCount = 0;
    disconnectCount = 0;
    #doc: Doc;
    constructor(_roomId: string, doc: Doc) {
      mocks.lastDoc = doc;
      mocks.lastProvider = this;
      this.#doc = doc;
      this.awareness = new Awareness(doc);
    }
    on() {}
    off() {}
    connect() {
      this.connected = true;
      this.connectCount += 1;
    }
    disconnect() {
      this.connected = false;
      this.disconnectCount += 1;
      // Mirror y-webrtc Room.disconnect(): the local client's awareness
      // entry is removed, leaving local state null until re-announced.
      removeAwarenessStates(this.awareness, [this.#doc.clientID], "disconnect");
    }
    destroy() {
      this.awareness.destroy();
    }
  }
  return { WebrtcProvider: FakeWebrtcProvider };
});

vi.mock("y-indexeddb", () => {
  class FakeIndexeddbPersistence {
    whenSynced: Promise<FakeIndexeddbPersistence>;
    synced = false;
    constructor(name: string, doc: Doc) {
      mocks.lastIdbName = name;
      mocks.lastIdbDoc = doc;
      mocks.idbDestroyed = false;
      const seed = mocks.idbSeedUpdate;
      this.whenSynced = Promise.resolve().then(() => {
        if (seed) applyUpdate(doc, seed);
        this.synced = true;
        return this;
      });
    }
    destroy() {
      mocks.idbDestroyed = true;
    }
  }
  return { IndexeddbPersistence: FakeIndexeddbPersistence };
});

const { useYjsMultiplayer } = await import("./useYjsMultiplayer.ts");
const { claimWinner, initializeRoom, joinRoom, setDifficulty, startGame } =
  await import("./p2p-room.ts");

// Flush the whenSynced microtask + resulting React effect so post-sync
// init has run before tests assert on state.
async function flushSync() {
  await act(async () => {});
}

beforeEach(() => {
  mocks.idbSeedUpdate = null;
  mocks.lastProvider = null;
});

// Force document.hidden + dispatch the visibilitychange event so the
// hook's listener fires. jsdom defaults to hidden=false and exposes
// the property as a getter, so we redefine it per call.
function setTabHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

function countClues(puzzle: string): number {
  return puzzle.split("").filter((c) => c !== ".").length;
}

describe("useYjsMultiplayer", () => {
  it("host writes chosen difficulty to Yjs on mount", async () => {
    const { result } = renderHook(() =>
      useYjsMultiplayer({
        roomId: "abc123",
        playerId: "p1",
        playerName: "Alice",
        difficulty: "expert",
      }),
    );

    await flushSync();
    expect(result.current.roomState?.difficulty).toBe("expert");
  });

  it("joiner with null difficulty does not initialize the room", async () => {
    // Joiners came in via a shared link with no chosen difficulty, so
    // they must not write any room defaults — initialization (and the
    // host claim it bundles with) is reserved for the creator so the
    // joiner never races for hostId.
    renderHook(() =>
      useYjsMultiplayer({
        roomId: "room-joiner",
        playerId: "p1",
        playerName: "Alice",
        difficulty: null,
      }),
    );

    await flushSync();
    const doc = mocks.lastDoc!;
    const roomMap = doc.getMap("room");
    expect(roomMap.get("difficulty")).toBeUndefined();
    expect(roomMap.get("hostId")).toBeUndefined();
    expect(roomMap.get("status")).toBeUndefined();
  });

  it("sendStartGame uses Yjs difficulty, not the local prop", async () => {
    const { result } = renderHook(() =>
      useYjsMultiplayer({
        roomId: "room-start",
        playerId: "p1",
        playerName: "Alice",
        difficulty: "easy",
      }),
    );

    await flushSync();
    const doc = mocks.lastDoc!;
    const fakeRoom = { doc, roomId: "room-start" };

    // Simulate opponent joining and host switching to expert via Yjs.
    act(() => {
      joinRoom(fakeRoom, "p2", "Bob");
      setDifficulty(fakeRoom, "expert");
    });

    act(() => {
      result.current.sendStartGame();
    });

    const puzzle = doc.getMap("room").get("puzzle") as string;
    expect(puzzle).toBeTruthy();
    // Expert digs to a minimal puzzle (~22-28 clues) — well below the
    // easy band (36-45) the local prop would have produced.
    expect(countClues(puzzle)).toBeGreaterThanOrEqual(17);
    expect(countClues(puzzle)).toBeLessThanOrEqual(28);
  });

  it("setDifficulty updates the Yjs room difficulty", async () => {
    const { result } = renderHook(() =>
      useYjsMultiplayer({
        roomId: "room-set",
        playerId: "p1",
        playerName: "Alice",
        difficulty: "easy",
      }),
    );

    await flushSync();
    const doc = mocks.lastDoc!;
    expect(doc.getMap("room").get("difficulty")).toBe("easy");

    act(() => {
      result.current.setDifficulty("hard");
    });

    expect(doc.getMap("room").get("difficulty")).toBe("hard");
  });

  it("persists the Yjs doc to IndexedDB under a per-room namespace", async () => {
    renderHook(() =>
      useYjsMultiplayer({
        roomId: "room-idb",
        playerId: "p1",
        playerName: "Alice",
        difficulty: "easy",
      }),
    );

    expect(mocks.lastIdbName).toBe("dokuel_room-idb");
    expect(mocks.lastIdbDoc).toBe(mocks.lastDoc);
    await flushSync();
  });

  it("destroys the IndexedDB persistence on unmount", async () => {
    const { unmount } = renderHook(() =>
      useYjsMultiplayer({
        roomId: "room-idb-destroy",
        playerId: "p1",
        playerName: "Alice",
        difficulty: "easy",
      }),
    );

    expect(mocks.idbDestroyed).toBe(false);
    await flushSync();
    unmount();
    expect(mocks.idbDestroyed).toBe(true);
  });

  it("keeps the same Y.Doc when playerName changes", async () => {
    const { rerender } = renderHook(
      ({ playerName }: { playerName: string }) =>
        useYjsMultiplayer({
          roomId: "room-rename",
          playerId: "p1",
          playerName,
          difficulty: "easy",
        }),
      { initialProps: { playerName: "Alice" } },
    );

    const docBefore = mocks.lastDoc;
    expect(docBefore).not.toBeNull();

    await flushSync();
    rerender({ playerName: "Alice Renamed" });
    await flushSync();

    expect(mocks.lastDoc).toBe(docBefore);
  });

  it("hasStartedGame latches true once gameNumber goes above zero", async () => {
    const { result } = renderHook(() =>
      useYjsMultiplayer({
        roomId: "room-latch",
        playerId: "p1",
        playerName: "Alice",
        difficulty: "easy",
      }),
    );

    await flushSync();
    expect(result.current.hasStartedGame).toBe(false);

    const doc = mocks.lastDoc!;
    const fakeRoom = { doc, roomId: "room-latch" };

    act(() => {
      joinRoom(fakeRoom, "p2", "Bob");
      result.current.sendStartGame();
    });

    expect(result.current.hasStartedGame).toBe(true);
  });

  it("sendRematch uses Yjs difficulty, not the local prop", async () => {
    const { result } = renderHook(() =>
      useYjsMultiplayer({
        roomId: "room-rematch",
        playerId: "p1",
        playerName: "Alice",
        difficulty: "easy",
      }),
    );

    await flushSync();
    const doc = mocks.lastDoc!;
    const fakeRoom = { doc, roomId: "room-rematch" };

    act(() => {
      joinRoom(fakeRoom, "p2", "Bob");
      setDifficulty(fakeRoom, "expert");
      result.current.sendStartGame();
    });

    act(() => {
      result.current.sendRematch();
    });

    const puzzle = doc.getMap("room").get("puzzle") as string;
    // Expert digs to a minimal puzzle (~22-28 clues) — well below the
    // easy band (36-45) the local prop would have produced.
    expect(countClues(puzzle)).toBeGreaterThanOrEqual(17);
    expect(countClues(puzzle)).toBeLessThanOrEqual(28);
  });

  it("preserves persisted gameNumber, puzzle, and solution across a fresh mount", async () => {
    // Build a seed update representing a previously-saved doc: a
    // started game with two players. Without the whenSynced gate, the
    // hook's synchronous joinRoom + initializeRoom would race the IDB
    // restore and the persisted state would be lost over multiple iOS
    // reloads. This test guards the fix.
    const seedDoc = new Doc();
    const seedRoom = { doc: seedDoc, roomId: "room-preserves" };
    initializeRoom(seedRoom, "p1", "medium");
    joinRoom(seedRoom, "p1", "Alice");
    joinRoom(seedRoom, "p2", "Bob");
    startGame(seedRoom);
    const seedGameNumber = seedDoc.getMap("room").get("gameNumber") as number;
    const seedPuzzle = seedDoc.getMap("room").get("puzzle") as string;
    const seedSolution = seedDoc.getMap("room").get("solution") as string;
    expect(seedGameNumber).toBeGreaterThan(0);
    expect(seedPuzzle).toBeTruthy();
    expect(seedSolution).toBeTruthy();

    mocks.idbSeedUpdate = encodeStateAsUpdate(seedDoc);

    const { result } = renderHook(() =>
      useYjsMultiplayer({
        roomId: "room-preserves",
        playerId: "p1",
        playerName: "Alice",
        difficulty: null,
      }),
    );

    await flushSync();

    expect(result.current.hasStartedGame).toBe(true);
    expect(result.current.puzzle).toBe(seedPuzzle);
    expect(result.current.solution).toBe(seedSolution);
    expect(result.current.roomState?.gameNumber).toBe(seedGameNumber);
    expect(result.current.roomState?.status).toBe("playing");
    expect(result.current.roomState?.players).toHaveLength(2);
  });

  it("flags roomFull for a third player arriving at a full room", async () => {
    // Seed IDB with a room that already has two other players, so the
    // join attempt no-ops and this client learns it is the odd one out.
    const seedDoc = new Doc();
    const seedRoom = { doc: seedDoc, roomId: "room-full" };
    initializeRoom(seedRoom, "p2", "medium");
    joinRoom(seedRoom, "p2", "Bob");
    joinRoom(seedRoom, "p3", "Carol");
    mocks.idbSeedUpdate = encodeStateAsUpdate(seedDoc);

    const { result } = renderHook(() =>
      useYjsMultiplayer({
        roomId: "room-full",
        playerId: "p1",
        playerName: "Alice",
        difficulty: null,
      }),
    );

    await flushSync();
    expect(result.current.roomFull).toBe(true);
    expect(result.current.roomState?.players).toHaveLength(2);
  });

  it("evicts itself from the players map after a concurrent-join overflow", async () => {
    // A concurrent-join merge can leave 3 entries even though joinRoom
    // capped locally. The overflow player (us, by deterministic seat
    // sort) must delete its own entry — otherwise the two seated
    // players stare at a lobby whose Start never enables.
    const { result } = renderHook(() =>
      useYjsMultiplayer({
        roomId: "room-overflow-evict",
        playerId: "p1",
        playerName: "Alice",
        difficulty: null,
      }),
    );
    await flushSync();
    const doc = mocks.lastDoc!;
    // Simulate the merged remote state: the host's room map plus two
    // players whose joinOrder/id sort ahead of ours ("a1"/"a2" < "p1"
    // at joinOrder 0).
    act(() => {
      initializeRoom({ doc, roomId: "room-overflow-evict" }, "a1", "medium");
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
    });
    await flushSync();

    expect(result.current.roomFull).toBe(true);
    expect(doc.getMap("players").has("p1")).toBe(false);
    expect(doc.getMap("players").size).toBe(2);
  });

  it("does not flag roomFull for a player already in the room", async () => {
    const seedDoc = new Doc();
    const seedRoom = { doc: seedDoc, roomId: "room-notfull" };
    initializeRoom(seedRoom, "p1", "medium");
    joinRoom(seedRoom, "p1", "Alice");
    joinRoom(seedRoom, "p2", "Bob");
    mocks.idbSeedUpdate = encodeStateAsUpdate(seedDoc);

    const { result } = renderHook(() =>
      useYjsMultiplayer({
        roomId: "room-notfull",
        playerId: "p1",
        playerName: "Alice",
        difficulty: null,
      }),
    );

    await flushSync();
    expect(result.current.roomFull).toBe(false);
  });

  it("re-raises an identical error so the toast can show again", async () => {
    // "Need 2 players to start" twice in a row: a string state field
    // is Object.is-equal on the second set, so the consumer's effect
    // never re-fires and the second tap silently does nothing.
    const { result } = renderHook(() =>
      useYjsMultiplayer({
        roomId: "room-error-retoast",
        playerId: "p1",
        playerName: "Alice",
        difficulty: "easy",
      }),
    );
    await flushSync();

    act(() => {
      result.current.sendStartGame();
    });
    const first = result.current.error;
    expect(first?.message).toBe("Need 2 players to start");

    act(() => {
      result.current.sendStartGame();
    });
    expect(result.current.error?.message).toBe("Need 2 players to start");
    expect(result.current.error).not.toBe(first);
  });

  describe("win claims", () => {
    async function setupStartedGame(roomId: string) {
      const { result } = renderHook(() =>
        useYjsMultiplayer({
          roomId,
          playerId: "p1",
          playerName: "Alice",
          difficulty: "easy",
        }),
      );
      await flushSync();
      const doc = mocks.lastDoc!;
      const fakeRoom = { doc, roomId };
      act(() => {
        joinRoom(fakeRoom, "p2", "Bob");
        startGame(fakeRoom);
      });
      await flushSync();
      const solution = doc.getMap("room").get("solution") as string;
      return { result, doc, fakeRoom, solution };
    }

    it("rejects a completion claim whose board does not match the solution", async () => {
      const { result, doc } = await setupStartedGame("room-claim-bad");
      act(() => {
        result.current.sendComplete("1".repeat(81));
      });
      expect(doc.getMap("room").get("winnerId")).toBeNull();
    });

    it("claims the win when the submitted board matches the solution", async () => {
      const { result, doc, solution } = await setupStartedGame("room-claim-ok");
      act(() => {
        result.current.sendComplete(solution);
      });
      expect(doc.getMap("room").get("winnerId")).toBe("p1");
      expect(doc.getMap("room").get("winnerBoard")).toBe(solution);
    });

    it("ignores a remote solved-claim whose board is forged", async () => {
      // A peer can write any winnerId it likes into the CRDT; the claim
      // only counts here if the board it ships actually solves the
      // puzzle.
      const { result, fakeRoom } = await setupStartedGame("room-claim-forged");
      act(() => {
        claimWinner(fakeRoom, "p2", "Bob", "1".repeat(81));
      });
      await flushSync();
      expect(result.current.gameOver).toBeNull();
    });

    it("treats an empty-string winner board as forged, not forfeit", async () => {
      // getRoomState must not coerce "" to null: null means an explicit
      // forfeit claim, while "" is just a solved-claim with no board —
      // the original one-liner cheat. If "" collapses to null it gets
      // accepted down the forfeit path.
      const { result, fakeRoom } = await setupStartedGame("room-claim-empty");
      act(() => {
        claimWinner(fakeRoom, "p2", "Bob", "");
      });
      await flushSync();
      expect(result.current.gameOver).toBeNull();
    });

    it("accepts a remote claim whose board matches the solution", async () => {
      const { result, fakeRoom, solution } =
        await setupStartedGame("room-claim-valid");
      act(() => {
        claimWinner(fakeRoom, "p2", "Bob", solution);
      });
      await flushSync();
      expect(result.current.gameOver).toEqual({
        winnerId: "p2",
        winnerName: "Bob",
      });
    });

    it("lets the real winner claim over a forged claim", async () => {
      const { result, doc, fakeRoom, solution } = await setupStartedGame(
        "room-claim-override",
      );
      act(() => {
        claimWinner(fakeRoom, "p2", "Bob", "1".repeat(81));
      });
      act(() => {
        result.current.sendComplete(solution);
      });
      expect(doc.getMap("room").get("winnerId")).toBe("p1");
    });

    it("claimForfeitWin records a win with no board", async () => {
      const { result, doc } = await setupStartedGame("room-claim-forfeit");
      act(() => {
        result.current.claimForfeitWin();
      });
      expect(doc.getMap("room").get("winnerId")).toBe("p1");
      expect(doc.getMap("room").get("winnerBoard")).toBeNull();
    });

    it("does not adopt a malformed remote puzzle", async () => {
      // The CRDT is peer-writable: a malicious or buggy peer can set
      // puzzle/solution to anything. Adopting garbage renders a NaN
      // board and bricks completion — keep the last valid game instead.
      const { result, doc } = await setupStartedGame("room-bad-puzzle");
      const goodPuzzle = result.current.puzzle;

      act(() => {
        doc.transact(() => {
          const roomMap = doc.getMap("room");
          roomMap.set("gameNumber", 99);
          roomMap.set("puzzle", "lol-not-a-board");
          roomMap.set("solution", "also-not-a-board");
        });
      });
      await flushSync();

      expect(result.current.puzzle).toBe(goodPuzzle);
    });

    it("adopts the merged puzzle after a concurrent start collides on gameNumber", async () => {
      // Both players tapping Start (or Rematch) inside sync latency
      // write the SAME gameNumber with different puzzles; Yjs LWW keeps
      // one. The losing writer already latched that number from its own
      // local write — without a content resync it would keep rendering
      // its own board while the room holds the other puzzle, and its
      // completion could never validate: a soft-locked game.
      const { result, doc } = await setupStartedGame("room-start-collision");
      const { generatePuzzleWithSolution } = await import("../lib/sudoku.ts");
      const other = generatePuzzleWithSolution("easy");

      act(() => {
        doc.transact(() => {
          const roomMap = doc.getMap("room");
          roomMap.set("puzzle", other.puzzle);
          roomMap.set("solution", other.solution);
        });
      });
      await flushSync();

      expect(result.current.puzzle).toBe(other.puzzle);
      expect(result.current.solution).toBe(other.solution);

      // And the game is actually winnable on the merged board.
      act(() => {
        result.current.sendComplete(other.solution);
      });
      expect(doc.getMap("room").get("winnerId")).toBe("p1");
    });

    it("ignores a forfeit claim received while we were continuously present", async () => {
      // A forfeit claim asserts that WE left. This client has been
      // connected and visible the whole game, so the claim is
      // fabricated (the one-liner devtools cheat) — don't lose on it.
      const { result, fakeRoom } = await setupStartedGame(
        "room-forfeit-present",
      );
      act(() => {
        claimWinner(fakeRoom, "p2", "Bob", null);
      });
      await flushSync();
      expect(result.current.gameOver).toBeNull();
    });
  });

  describe("visibility-driven WebRTC lifecycle", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      setTabHidden(false);
    });

    afterEach(() => {
      // The hook is still mounted here (RTL auto-cleanup runs after
      // this), and un-hiding dispatches visibilitychange into it.
      act(() => {
        setTabHidden(false);
      });
      vi.useRealTimers();
    });

    it("disconnects the WebRTC provider after the hide debounce", async () => {
      renderHook(() =>
        useYjsMultiplayer({
          roomId: "room-hide",
          playerId: "p1",
          playerName: "Alice",
          difficulty: "easy",
        }),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const provider = mocks.lastProvider!;
      provider.connected = true;
      provider.disconnectCount = 0;

      act(() => {
        setTabHidden(true);
      });
      expect(provider.disconnectCount).toBe(0);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });
      expect(provider.disconnectCount).toBe(1);
      expect(provider.connected).toBe(false);
    });

    it("does not disconnect if the tab returns before the debounce", async () => {
      renderHook(() =>
        useYjsMultiplayer({
          roomId: "room-hide-cancel",
          playerId: "p1",
          playerName: "Alice",
          difficulty: "easy",
        }),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const provider = mocks.lastProvider!;
      provider.connected = true;
      provider.disconnectCount = 0;

      act(() => {
        setTabHidden(true);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });
      act(() => {
        setTabHidden(false);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });

      expect(provider.disconnectCount).toBe(0);
    });

    it("reconnects when the tab returns after disconnecting", async () => {
      renderHook(() =>
        useYjsMultiplayer({
          roomId: "room-rejoin",
          playerId: "p1",
          playerName: "Alice",
          difficulty: "easy",
        }),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const provider = mocks.lastProvider!;
      provider.connected = true;
      provider.connectCount = 0;

      act(() => {
        setTabHidden(true);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });
      expect(provider.connected).toBe(false);

      act(() => {
        setTabHidden(false);
      });
      expect(provider.connectCount).toBe(1);
      expect(provider.connected).toBe(true);
    });

    it("re-announces presence after the reconnect", async () => {
      renderHook(() =>
        useYjsMultiplayer({
          roomId: "room-reannounce",
          playerId: "p1",
          playerName: "Alice",
          difficulty: "easy",
        }),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const provider = mocks.lastProvider!;
      provider.connected = true;

      act(() => {
        setTabHidden(true);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });
      // The disconnect wiped our awareness entry — from the opponent's
      // point of view we vanished.
      expect(provider.awareness.getLocalState()).toBeNull();

      act(() => {
        setTabHidden(false);
      });
      // Without a working re-announce the opponent keeps seeing us as
      // disconnected forever and is offered a forfeit win while we are
      // actively playing.
      expect(provider.awareness.getLocalState()?.user).toEqual({
        id: "p1",
        name: "Alice",
      });
    });

    it("accepts a forfeit claim after we really were away", async () => {
      const { result } = renderHook(() =>
        useYjsMultiplayer({
          roomId: "room-forfeit-away",
          playerId: "p1",
          playerName: "Alice",
          difficulty: "easy",
        }),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const doc = mocks.lastDoc!;
      const fakeRoom = { doc, roomId: "room-forfeit-away" };
      act(() => {
        joinRoom(fakeRoom, "p2", "Bob");
        startGame(fakeRoom);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // We disappear long enough for the WebRTC drop, then return; the
      // opponent's forfeit claim lands right after. That absence was
      // real, so the claim must be honored.
      act(() => {
        setTabHidden(true);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });
      act(() => {
        setTabHidden(false);
      });
      act(() => {
        claimWinner(fakeRoom, "p2", "Bob", null);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(result.current.gameOver).toEqual({
        winnerId: "p2",
        winnerName: "Bob",
      });
    });

    it("does not flag opponent as disconnected while we are the hidden one", async () => {
      const { result } = renderHook(() =>
        useYjsMultiplayer({
          roomId: "room-hide-flag",
          playerId: "p1",
          playerName: "Alice",
          difficulty: "easy",
        }),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const doc = mocks.lastDoc!;
      const fakeRoom = { doc, roomId: "room-hide-flag" };
      // Two players in the doc, no awareness peers → before the fix
      // this would flip to true. With the !document.hidden gate it
      // must stay false because *we* are the one going away.
      await act(async () => {
        joinRoom(fakeRoom, "p2", "Bob");
        setTabHidden(true);
      });
      expect(result.current.opponentDisconnected).toBe(false);
    });
  });

  describe("localStorage snapshot fallback", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    function seedSnapshot(roomId: string) {
      localStorage.setItem(
        `dokuel_mp_snap_${roomId}`,
        JSON.stringify({
          gameNumber: 4,
          puzzle: ".".repeat(81),
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

    it("hydrates from snapshot when IndexedDB returns no started game", async () => {
      vi.useFakeTimers();
      try {
        seedSnapshot("room-hydrate");

        const { result } = renderHook(() =>
          useYjsMultiplayer({
            roomId: "room-hydrate",
            playerId: "p1",
            playerName: "Alice",
            difficulty: null,
          }),
        );

        // The snapshot is applied only after a grace window in which no
        // live peer state arrived.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(3_000);
        });

        expect(result.current.hasStartedGame).toBe(true);
        expect(result.current.puzzle).toBe(".".repeat(81));
        expect(result.current.roomState?.gameNumber).toBe(4);
        expect(result.current.roomState?.difficulty).toBe("hard");
      } finally {
        vi.useRealTimers();
      }
    });

    it("prefers live peer state that arrives during the hydration grace window", async () => {
      // Hydrating a ≤1h-old snapshot into a FRESH doc makes every key
      // causally concurrent with the live room — per-key LWW can then
      // roll a finished/advanced game back for both peers. When real
      // state arrives first, the snapshot must stay unapplied.
      vi.useFakeTimers();
      try {
        seedSnapshot("room-snap-race");

        const { result } = renderHook(() =>
          useYjsMultiplayer({
            roomId: "room-snap-race",
            playerId: "p1",
            playerName: "Alice",
            difficulty: null,
          }),
        );
        // Make our writes win LWW ties so a premature hydration is
        // deterministically visible instead of a clientID coin flip.
        mocks.lastDoc!.clientID = 0x7fffffff;

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1_000);
        });

        // The peer's real room arrives over WebRTC: game 7, different
        // puzzle, already finished.
        const seedDoc = new Doc();
        const seedRoom = { doc: seedDoc, roomId: "room-snap-race" };
        initializeRoom(seedRoom, "p2", "medium");
        joinRoom(seedRoom, "p2", "Bob");
        joinRoom(seedRoom, "p1", "Alice");
        for (let i = 0; i < 7; i++) startGame(seedRoom);
        act(() => {
          applyUpdate(mocks.lastDoc!, encodeStateAsUpdate(seedDoc));
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(5_000);
        });

        expect(result.current.roomState?.gameNumber).toBe(7);
        expect(result.current.roomState?.difficulty).toBe("medium");
      } finally {
        vi.useRealTimers();
      }
    });

    it("does not hydrate when IndexedDB already has a started game", async () => {
      const seedDoc = new Doc();
      const seedRoom = { doc: seedDoc, roomId: "room-no-hydrate" };
      initializeRoom(seedRoom, "p1", "medium");
      joinRoom(seedRoom, "p1", "Alice");
      joinRoom(seedRoom, "p2", "Bob");
      for (let i = 0; i < 7; i++) startGame(seedRoom);
      mocks.idbSeedUpdate = encodeStateAsUpdate(seedDoc);

      localStorage.setItem(
        "dokuel_mp_snap_room-no-hydrate",
        JSON.stringify({
          gameNumber: 2,
          puzzle: "1".padEnd(81, "."),
          status: "playing",
          difficulty: "easy",
          assistLevel: "standard",
          hostId: "p1",
          players: [],
          winnerId: null,
          winnerName: null,
          savedAt: Date.now(),
        }),
      );

      const { result } = renderHook(() =>
        useYjsMultiplayer({
          roomId: "room-no-hydrate",
          playerId: "p1",
          playerName: "Alice",
          difficulty: null,
        }),
      );

      await flushSync();

      expect(result.current.roomState?.gameNumber).toBe(7);
      expect(result.current.roomState?.difficulty).not.toBe("easy");
    });

    it("writes a snapshot to localStorage on pagehide", async () => {
      const { result } = renderHook(() =>
        useYjsMultiplayer({
          roomId: "room-pagehide",
          playerId: "p1",
          playerName: "Alice",
          difficulty: "easy",
        }),
      );
      await flushSync();
      const doc = mocks.lastDoc!;
      const fakeRoom = { doc, roomId: "room-pagehide" };
      act(() => {
        joinRoom(fakeRoom, "p2", "Bob");
        result.current.sendStartGame();
      });

      expect(localStorage.getItem("dokuel_mp_snap_room-pagehide")).toBeNull();
      act(() => {
        window.dispatchEvent(new Event("pagehide"));
      });
      const raw = localStorage.getItem("dokuel_mp_snap_room-pagehide");
      expect(raw).not.toBeNull();
      const snap = JSON.parse(raw!);
      expect(snap.gameNumber).toBeGreaterThan(0);
      expect(snap.players).toHaveLength(2);
    });
  });
});
