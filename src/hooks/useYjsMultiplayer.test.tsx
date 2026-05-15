import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type * as Y from "yjs";

const mocks = vi.hoisted(() => ({
  lastDoc: null as Y.Doc | null,
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

const { useYjsMultiplayer } = await import("./useYjsMultiplayer.ts");
const { joinRoom, setDifficulty } = await import("../lib/p2p-room.ts");

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

  it("joiner does not write difficulty or hostId to Yjs", () => {
    renderHook(() =>
      useYjsMultiplayer({
        roomId: "room-joiner",
        playerId: "p1",
        playerName: "Alice",
        difficulty: null,
      }),
    );

    const roomMap = mocks.lastDoc!.getMap("room");
    expect(roomMap.has("difficulty")).toBe(false);
    expect(roomMap.has("hostId")).toBe(false);
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
