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

  it("reports every row, column and box the placement completes", () => {
    const prev = solvedExcept([4, 4]);
    const next = withValue(prev, 4, 4, 5);

    expect(diffBoardForAmbiance(prev, next, new Set())).toEqual([
      { type: "place", row: 4, col: 4, digit: 5 },
      { type: "unit", kind: "row", index: 4 },
      { type: "unit", kind: "col", index: 4 },
      { type: "unit", kind: "box", index: 4 },
    ]);
  });

  it("does not count a full unit that still holds a conflict", () => {
    const prev = solvedExcept([4, 4], [4, 5]);
    const next = withValue(withValue(prev, 4, 4, 5), 4, 5, 5);

    const events = diffBoardForAmbiance(prev, next, new Set([4 * 9 + 5]));

    expect(events.filter((e) => e.type === "unit")).toEqual([
      { type: "unit", kind: "col", index: 4 },
    ]);
  });
});
