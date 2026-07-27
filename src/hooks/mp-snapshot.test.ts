import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomState } from "../lib/types.ts";
import { clearSnapshot, loadSnapshot, saveSnapshot } from "./mp-snapshot.ts";

function makeState(overrides: Partial<RoomState> = {}): RoomState {
  return {
    roomId: "room-1",
    status: "playing",
    difficulty: "medium",
    assistLevel: "standard",
    hostId: "p1",
    players: [
      {
        id: "p1",
        name: "Alice",
        color: "#3B82F6",
        cellsRemaining: 40,
        completionPercent: 50,
      },
      {
        id: "p2",
        name: "Bob",
        color: "#EF4444",
        cellsRemaining: 30,
        completionPercent: 63,
      },
    ],
    puzzle: ".".repeat(81),
    solution: "1".repeat(81),
    winnerId: null,
    winnerName: null,
    winnerBoard: null,
    gameNumber: 1,
    events: [],
    ...overrides,
  };
}

describe("mp-snapshot", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips a saved snapshot", () => {
    saveSnapshot("room-1", makeState());
    const snap = loadSnapshot("room-1");
    expect(snap).not.toBeNull();
    expect(snap?.gameNumber).toBe(1);
    expect(snap?.players).toHaveLength(2);
    expect(snap?.puzzle).toBe(".".repeat(81));
    expect(snap?.solution).toBe("1".repeat(81));
  });

  it("skips saving when no game has started", () => {
    saveSnapshot("room-1", makeState({ gameNumber: 0 }));
    expect(loadSnapshot("room-1")).toBeNull();
  });

  it("returns null for an unknown room", () => {
    expect(loadSnapshot("never-saved")).toBeNull();
  });

  it("rejects snapshots older than one hour", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    saveSnapshot("room-stale", makeState());
    vi.setSystemTime(new Date("2026-01-01T14:00:00Z")); // +2h
    expect(loadSnapshot("room-stale")).toBeNull();
  });

  it("clears a stored snapshot", () => {
    saveSnapshot("room-clear", makeState());
    expect(loadSnapshot("room-clear")).not.toBeNull();
    clearSnapshot("room-clear");
    expect(loadSnapshot("room-clear")).toBeNull();
  });

  it("scopes snapshots per room", () => {
    saveSnapshot("room-a", makeState({ gameNumber: 5 }));
    saveSnapshot("room-b", makeState({ gameNumber: 9 }));
    expect(loadSnapshot("room-a")?.gameNumber).toBe(5);
    expect(loadSnapshot("room-b")?.gameNumber).toBe(9);
  });

  it("returns null when stored JSON is malformed", () => {
    localStorage.setItem("dokuel_mp_snap_room-bad", "{not-json");
    expect(loadSnapshot("room-bad")).toBeNull();
  });
});
