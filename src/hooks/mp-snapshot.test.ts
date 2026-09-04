import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomState } from "../lib/types.ts";
import {
  clearSnapshot,
  loadSnapshot,
  saveSnapshot,
  sweepStaleSnapshots,
} from "./mp-snapshot.ts";

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

  it("round-trips finished proof and rematch consent in the versioned schema", () => {
    const solution = "1".repeat(81);
    saveSnapshot(
      "room-finished",
      makeState({
        status: "finished",
        winnerId: "p2",
        winnerName: "Bob",
        winnerBoard: solution,
        rematchReady: ["p1"],
      }),
    );

    const snap = loadSnapshot("room-finished") as typeof loadSnapshot extends (
      roomId: string,
    ) => infer Snapshot
      ? Snapshot & {
          version?: number;
          rematchReady?: string[];
        }
      : never;

    expect(snap).toMatchObject({
      version: 2,
      status: "finished",
      winnerId: "p2",
      winnerName: "Bob",
      winnerBoard: solution,
      rematchReady: ["p1"],
    });
  });

  it("round-trips shared start and both completion proofs", () => {
    const solution = "1".repeat(81);
    saveSnapshot(
      "room-shared-start",
      makeState({
        startedAt: 1_000,
        readyPlayers: ["p1", "p2"],
        results: {
          p1: { completedAt: 2_000, board: solution },
          p2: { completedAt: 3_000, board: solution },
        },
      }),
    );

    expect(loadSnapshot("room-shared-start")).toMatchObject({
      version: 2,
      startedAt: 1_000,
      readyPlayers: ["p1", "p2"],
      results: {
        p1: { completedAt: 2_000, board: solution },
        p2: { completedAt: 3_000, board: solution },
      },
    });
  });

  it("migrates an unversioned snapshot with defaults for new recovery fields", () => {
    localStorage.setItem(
      "dokuel_mp_snap_legacy",
      JSON.stringify({
        gameNumber: 3,
        puzzle: ".".repeat(81),
        solution: "1".repeat(81),
        status: "playing",
        difficulty: "medium",
        assistLevel: "standard",
        hostId: "p1",
        players: makeState().players,
        winnerId: null,
        winnerName: null,
        savedAt: Date.now(),
      }),
    );

    expect(loadSnapshot("legacy")).toMatchObject({
      version: 2,
      winnerBoard: null,
      rematchReady: [],
    });
  });

  it("rejects a snapshot with a malformed player record", () => {
    saveSnapshot("room-corrupt-player", makeState());
    const raw = JSON.parse(
      localStorage.getItem("dokuel_mp_snap_room-corrupt-player") as string,
    ) as Record<string, unknown>;
    raw.players = [{ id: "p1" }];
    localStorage.setItem(
      "dokuel_mp_snap_room-corrupt-player",
      JSON.stringify(raw),
    );

    expect(loadSnapshot("room-corrupt-player")).toBeNull();
  });

  it.each([
    ["status", { status: "paused" }],
    ["difficulty", { difficulty: "unknown" }],
    ["assist level", { assistLevel: "helpful" }],
    ["game counter", { gameNumber: 0 }],
    ["timestamp", { savedAt: "now" }],
    ["puzzle shape", { puzzle: "not-a-grid" }],
    ["solution shape", { solution: "not-a-grid" }],
    ["puzzle givens", { puzzle: `2${".".repeat(80)}` }],
    ["winner nullability", { winnerId: "p1" }],
    [
      "winner proof",
      {
        status: "finished",
        winnerId: "p1",
        winnerName: "Alice",
        winnerBoard: "2".repeat(81),
      },
    ],
    ["host membership", { hostId: "ghost" }],
    [
      "rematch player membership",
      {
        status: "finished",
        winnerId: "p1",
        winnerName: "Alice",
        rematchReady: ["ghost"],
      },
    ],
  ])("rejects corrupt durable field: %s", (_field, changes) => {
    saveSnapshot("room-corrupt-field", makeState());
    const raw = JSON.parse(
      localStorage.getItem("dokuel_mp_snap_room-corrupt-field") as string,
    ) as Record<string, unknown>;
    Object.assign(raw, changes);
    localStorage.setItem(
      "dokuel_mp_snap_room-corrupt-field",
      JSON.stringify(raw),
    );

    expect(loadSnapshot("room-corrupt-field")).toBeNull();
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

  it("sweeps expired and malformed snapshot keys, keeping fresh ones", () => {
    // loadSnapshot treats an over-age snapshot as absent but leaves the
    // key in place — every room ever visited parked ~2KB in
    // localStorage forever. The sweep removes what load would refuse,
    // and returns the rooms it dropped so IDB cleanup can follow.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    saveSnapshot("room-old", makeState());
    localStorage.setItem("dokuel_mp_snap_room-junk", "{not-json");
    localStorage.setItem("unrelated_key", "keep-me");

    vi.setSystemTime(new Date("2026-01-01T14:00:00Z")); // +2h
    saveSnapshot("room-fresh", makeState());

    const swept = sweepStaleSnapshots();

    expect([...swept].sort((a, b) => a.localeCompare(b))).toEqual([
      "room-junk",
      "room-old",
    ]);
    expect(localStorage.getItem("dokuel_mp_snap_room-old")).toBeNull();
    expect(localStorage.getItem("dokuel_mp_snap_room-junk")).toBeNull();
    expect(loadSnapshot("room-fresh")).not.toBeNull();
    expect(localStorage.getItem("unrelated_key")).toBe("keep-me");
  });
});
