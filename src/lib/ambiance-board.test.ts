import { describe, expect, it } from "vitest";
import { diffBoardForAmbiance } from "./ambiance-board.ts";
import { parsePuzzle } from "./sudoku.ts";
import type { Board } from "./types.ts";

const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

/** The solved board with the listed cells emptied. */
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

describe("diffBoardForAmbiance", () => {
  it("reports a freshly placed value with its cell and digit", () => {
    const prev = solvedExcept([1, 1], [1, 2], [2, 1]);
    const next = withValue(prev, 1, 1, 7);

    expect(diffBoardForAmbiance(prev, next, new Set())).toEqual([
      { type: "place", row: 1, col: 1, digit: 7 },
    ]);
  });

  it("reports a value that lands in conflict as a conflict instead", () => {
    const prev = solvedExcept([1, 1], [1, 2], [2, 1]);
    const next = withValue(prev, 1, 1, 3);

    expect(diffBoardForAmbiance(prev, next, new Set([1 * 9 + 1]))).toEqual([
      { type: "conflict", row: 1, col: 1 },
    ]);
  });
});
