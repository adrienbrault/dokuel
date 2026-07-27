import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyUpdate, Doc, encodeStateAsUpdate } from "yjs";

type FakeProvider = {
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

vi.mock("y-webrtc", () => {
  class FakeWebrtcProvider implements FakeProvider {
    awareness = {
      setLocalStateField: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      getStates: () => new Map(),
    };
    connected = false;
    connectCount = 0;
    disconnectCount = 0;
    constructor(_roomId: string, doc: Doc) {
      mocks.lastDoc = doc;
      mocks.lastProvider = this;
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
    }
    destroy() {}
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
  });

  describe("visibility-driven WebRTC lifecycle", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      setTabHidden(false);
    });

    afterEach(() => {
      vi.useRealTimers();
      setTabHidden(false);
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

    it("hydrates from snapshot when IndexedDB returns no started game", async () => {
      localStorage.setItem(
        "dokuel_mp_snap_room-hydrate",
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

      const { result } = renderHook(() =>
        useYjsMultiplayer({
          roomId: "room-hydrate",
          playerId: "p1",
          playerName: "Alice",
          difficulty: null,
        }),
      );

      await flushSync();

      expect(result.current.hasStartedGame).toBe(true);
      expect(result.current.puzzle).toBe(".".repeat(81));
      expect(result.current.roomState?.gameNumber).toBe(4);
      expect(result.current.roomState?.difficulty).toBe("hard");
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
