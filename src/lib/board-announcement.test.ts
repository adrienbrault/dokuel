import { describe, expect, it } from "vitest";
import { describeBoardChange } from "./board-announcement.ts";
import type { Board, Cell } from "./types.ts";

function cell(value: number | null = null, notes: number[] = []): Cell {
  return { value, isGiven: false, notes: new Set(notes) };
}

function makeBoard(overrides: [number, number, Partial<Cell>][] = []): Board {
  const board = Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => cell()),
  );
  for (const [r, c, patch] of overrides) {
    board[r]![c] = { ...cell(), ...patch };
  }
  return board;
}

describe("describeBoardChange", () => {
  it("announces a placed value with its position", () => {
    const prev = makeBoard();
    const next = makeBoard([[2, 3, { value: 5 }]]);
    expect(describeBoardChange(prev, next, new Set())).toBe(
      "5 placed, row 3 column 4",
    );
  });

  it("announces an erased value", () => {
    const prev = makeBoard([[0, 8, { value: 7 }]]);
    const next = makeBoard();
    expect(describeBoardChange(prev, next, new Set())).toBe(
      "7 erased, row 1 column 9",
    );
  });

  it("flags a placed value that conflicts", () => {
    const prev = makeBoard([[2, 0, { value: 5 }]]);
    const next = makeBoard([
      [2, 0, { value: 5 }],
      [2, 3, { value: 5 }],
    ]);
    // Keys are row * 9 + col (cellKey).
    expect(describeBoardChange(prev, next, new Set([18, 21]))).toBe(
      "5 placed, row 3 column 4, conflict",
    );
  });

  it("announces a toggled pencil note", () => {
    const empty = makeBoard([[4, 4, { notes: new Set([1]) }]]);
    const noted = makeBoard([[4, 4, { notes: new Set([1, 6]) }]]);
    expect(describeBoardChange(empty, noted, new Set())).toBe(
      "Note 6 added, row 5 column 5",
    );
    expect(describeBoardChange(noted, empty, new Set())).toBe(
      "Note 6 removed, row 5 column 5",
    );
  });

  it("summarises a note pencilled across a multi-cell selection", () => {
    const prev = makeBoard();
    const next = makeBoard([
      [0, 0, { notes: new Set([3]) }],
      [0, 1, { notes: new Set([3]) }],
      [1, 1, { notes: new Set([3]) }],
    ]);
    expect(describeBoardChange(prev, next, new Set())).toBe(
      "Note 3 added in 3 cells",
    );
    expect(describeBoardChange(next, prev, new Set())).toBe(
      "Note 3 removed in 3 cells",
    );
  });

  it("falls back to a generic phrase for mixed note edits", () => {
    const prev = makeBoard([[0, 0, { notes: new Set([1, 2, 3]) }]]);
    const next = makeBoard();
    expect(describeBoardChange(prev, next, new Set())).toBe(
      "Notes updated, row 1 column 1",
    );
  });

  it("stays silent when a new puzzle replaces the board", () => {
    const prev = makeBoard([[0, 0, { value: 1, isGiven: true }]]);
    const next = makeBoard([
      [0, 0, { value: 4, isGiven: true }],
      [5, 5, { value: 9, isGiven: true }],
    ]);
    expect(describeBoardChange(prev, next, new Set())).toBeNull();
  });

  it("stays silent when a same-shaped puzzle swaps its given digits", () => {
    const prev = makeBoard([[3, 3, { value: 1, isGiven: true }]]);
    const next = makeBoard([[3, 3, { value: 2, isGiven: true }]]);
    expect(describeBoardChange(prev, next, new Set())).toBeNull();
  });

  it("says nothing when nothing changed", () => {
    expect(describeBoardChange(makeBoard(), makeBoard(), new Set())).toBeNull();
  });

  it("uses the generic phrase when cells toggle different notes", () => {
    const prev = makeBoard();
    const next = makeBoard([
      [0, 0, { notes: new Set([3]) }],
      [0, 1, { notes: new Set([4]) }],
    ]);
    expect(describeBoardChange(prev, next, new Set())).toBe(
      "Notes updated in 2 cells",
    );
  });
});
