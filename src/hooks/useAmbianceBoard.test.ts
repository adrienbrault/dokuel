import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AmbianceEvent, ambiance } from "../lib/ambiance.ts";
import { parsePuzzle } from "../lib/sudoku.ts";
import type { Board, GameStatus } from "../lib/types.ts";
import { useAmbianceBoard, useAmbianceRival } from "./useAmbianceBoard.ts";

const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

function solvedExcept(...cells: [number, number][]): Board {
  const chars = SOLUTION.split("");
  for (const [row, col] of cells) chars[row * 9 + col] = ".";
  return parsePuzzle(chars.join(""));
}

function withValue(board: Board, row: number, col: number, value: number) {
  const next = board.map((r) => r.map((c) => ({ ...c })));
  next[row]![col]!.value = value;
  return next;
}

const NO_CLASHES = new Set<number>();

function listen() {
  const events: AmbianceEvent[] = [];
  const unsubscribe = ambiance.subscribe((e) => events.push(e));
  return { events, unsubscribe };
}

describe("useAmbianceBoard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    ambiance.setScene("menu");
  });

  it("stays quiet for the board it mounts with", () => {
    const { events, unsubscribe } = listen();
    renderHook(() =>
      useAmbianceBoard(solvedExcept([0, 0], [0, 1]), NO_CLASHES, "playing"),
    );
    unsubscribe();

    expect(events).toEqual([]);
  });

  it("emits what changed as the board moves on", () => {
    const start = solvedExcept([0, 0], [0, 1], [1, 0]);
    const { events, unsubscribe } = listen();
    const { rerender } = renderHook(
      ({ board }) => useAmbianceBoard(board, NO_CLASHES, "playing"),
      { initialProps: { board: start } },
    );

    rerender({ board: withValue(start, 0, 0, 5) });
    unsubscribe();

    expect(events).toEqual([{ type: "place", row: 0, col: 0, digit: 5 }]);
  });

  it("celebrates once when the board is solved", () => {
    const board = parsePuzzle(SOLUTION);
    const { events, unsubscribe } = listen();
    const { rerender } = renderHook(
      ({ status }: { status: GameStatus }) =>
        useAmbianceBoard(board, NO_CLASHES, status),
      { initialProps: { status: "playing" as GameStatus } },
    );

    rerender({ status: "completed" });
    rerender({ status: "completed" });
    unsubscribe();

    expect(events).toEqual([{ type: "victory" }]);
  });

  it("reports how much of the puzzle the player has filled", () => {
    const start = solvedExcept([0, 0], [0, 1], [1, 0], [1, 1]);
    const { rerender } = renderHook(
      ({ board }) => useAmbianceBoard(board, NO_CLASHES, "playing"),
      { initialProps: { board: start } },
    );
    expect(ambiance.getState().progress).toBe(0);

    rerender({ board: withValue(start, 0, 0, 5) });

    expect(ambiance.getState().progress).toBe(0.25);
  });
});

describe("useAmbianceRival", () => {
  it("ripples once for each cell the opponent fills, never for undo", () => {
    const { events, unsubscribe } = listen();
    const { rerender } = renderHook(
      ({ remaining }: { remaining: number | null }) =>
        useAmbianceRival(remaining),
      { initialProps: { remaining: null as number | null } },
    );

    rerender({ remaining: 40 });
    rerender({ remaining: 39 });
    rerender({ remaining: 37 });
    rerender({ remaining: 38 });
    unsubscribe();

    expect(events).toEqual([
      { type: "rival" },
      { type: "rival" },
      { type: "rival" },
    ]);
  });
});
