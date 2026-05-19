import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyUpdate, Doc, encodeStateAsUpdate } from "yjs";

const mocks = vi.hoisted(() => ({
  lastDoc: null as Doc | null,
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
  class FakeWebrtcProvider {
    awareness = {
      setLocalStateField: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      getStates: () => new Map(),
    };
    connected = false;
    constructor(_roomId: string, doc: Doc) {
      mocks.lastDoc = doc;
    }
    on() {}
    off() {}
    disconnect() {}
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
const { initializeRoom, joinRoom, setDifficulty, startGame } = await import(
  "./p2p-room.ts"
);

// Flush the whenSynced microtask + resulting React effect so post-sync
// init has run before tests assert on state.
async function flushSync() {
  await act(async () => {});
}

beforeEach(() => {
  mocks.idbSeedUpdate = null;
});

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
    expect(countClues(puzzle)).toBeGreaterThanOrEqual(17);
    expect(countClues(puzzle)).toBeLessThanOrEqual(21);
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
    expect(countClues(puzzle)).toBeGreaterThanOrEqual(17);
    expect(countClues(puzzle)).toBeLessThanOrEqual(21);
  });

  it("preserves persisted gameNumber and puzzle across a fresh mount", async () => {
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
    expect(seedGameNumber).toBeGreaterThan(0);
    expect(seedPuzzle).toBeTruthy();

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
    expect(result.current.roomState?.gameNumber).toBe(seedGameNumber);
    expect(result.current.roomState?.status).toBe("playing");
    expect(result.current.roomState?.players).toHaveLength(2);
  });
});
