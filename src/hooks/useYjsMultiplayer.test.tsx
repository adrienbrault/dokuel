import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type * as Y from "yjs";

const mocks = vi.hoisted(() => ({
  lastDoc: null as Y.Doc | null,
  lastIdbName: null as string | null,
  lastIdbDoc: null as Y.Doc | null,
  idbDestroyed: false,
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
    constructor(_roomId: string, doc: Y.Doc) {
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
    constructor(name: string, doc: Y.Doc) {
      mocks.lastIdbName = name;
      mocks.lastIdbDoc = doc;
      mocks.idbDestroyed = false;
    }
    destroy() {
      mocks.idbDestroyed = true;
    }
  }
  return { IndexeddbPersistence: FakeIndexeddbPersistence };
});

const { useYjsMultiplayer } = await import("./useYjsMultiplayer.ts");
const { joinRoom, setDifficulty } = await import("./p2p-room.ts");

function countClues(puzzle: string): number {
  return puzzle.split("").filter((c) => c !== ".").length;
}

describe("useYjsMultiplayer", () => {
  it("host writes chosen difficulty to Yjs on mount", () => {
    const { result } = renderHook(() =>
      useYjsMultiplayer({
        roomId: "abc123",
        playerId: "p1",
        playerName: "Alice",
        difficulty: "expert",
      }),
    );

    expect(result.current.roomState?.difficulty).toBe("expert");
  });

  it("joiner with null difficulty does not write null to Yjs", () => {
    renderHook(() =>
      useYjsMultiplayer({
        roomId: "room-joiner",
        playerId: "p1",
        playerName: "Alice",
        difficulty: null,
      }),
    );

    const doc = mocks.lastDoc!;
    expect(doc.getMap("room").get("difficulty")).toBe("medium");
  });

  it("sendStartGame uses Yjs difficulty, not the local prop", () => {
    const { result } = renderHook(() =>
      useYjsMultiplayer({
        roomId: "room-start",
        playerId: "p1",
        playerName: "Alice",
        difficulty: "easy",
      }),
    );

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

  it("setDifficulty updates the Yjs room difficulty", () => {
    const { result } = renderHook(() =>
      useYjsMultiplayer({
        roomId: "room-set",
        playerId: "p1",
        playerName: "Alice",
        difficulty: "easy",
      }),
    );

    const doc = mocks.lastDoc!;
    expect(doc.getMap("room").get("difficulty")).toBe("easy");

    act(() => {
      result.current.setDifficulty("hard");
    });

    expect(doc.getMap("room").get("difficulty")).toBe("hard");
  });

  it("persists the Yjs doc to IndexedDB under a per-room namespace", () => {
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
  });

  it("destroys the IndexedDB persistence on unmount", () => {
    const { unmount } = renderHook(() =>
      useYjsMultiplayer({
        roomId: "room-idb-destroy",
        playerId: "p1",
        playerName: "Alice",
        difficulty: "easy",
      }),
    );

    expect(mocks.idbDestroyed).toBe(false);
    unmount();
    expect(mocks.idbDestroyed).toBe(true);
  });

  it("keeps the same Y.Doc when playerName changes", () => {
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

    rerender({ playerName: "Alice Renamed" });

    expect(mocks.lastDoc).toBe(docBefore);
  });

  it("hasStartedGame latches true once gameNumber goes above zero", () => {
    const { result } = renderHook(() =>
      useYjsMultiplayer({
        roomId: "room-latch",
        playerId: "p1",
        playerName: "Alice",
        difficulty: "easy",
      }),
    );

    expect(result.current.hasStartedGame).toBe(false);

    const doc = mocks.lastDoc!;
    const fakeRoom = { doc, roomId: "room-latch" };

    act(() => {
      joinRoom(fakeRoom, "p2", "Bob");
      result.current.sendStartGame();
    });

    expect(result.current.hasStartedGame).toBe(true);
  });

  it("sendRematch uses Yjs difficulty, not the local prop", () => {
    const { result } = renderHook(() =>
      useYjsMultiplayer({
        roomId: "room-rematch",
        playerId: "p1",
        playerName: "Alice",
        difficulty: "easy",
      }),
    );

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
});
