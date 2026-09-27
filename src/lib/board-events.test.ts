import { describe, expect, it } from "vitest";
import { diffBoards } from "./board-events.ts";
import { parsePuzzle } from "./sudoku.ts";
import type { Board } from "./types.ts";

const SOLVED =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

function withValue(
  board: Board,
  row: number,
  col: number,
  value: number | null,
) {
  const next = board.map((r) => r.map((c) => ({ ...c })));
  next[row]![col]!.value = value;
  return next;
}

describe("diffBoards", () => {
  it("reports cells that gained or lost a value", () => {
    const empty = parsePuzzle(".".repeat(81));
    const placed = withValue(empty, 2, 3, 7);
    expect(diffBoards(empty, placed)).toMatchObject({
      placed: [2 * 9 + 3],
      cleared: [],
    });
    expect(diffBoards(placed, empty)).toMatchObject({
      placed: [],
      cleared: [2 * 9 + 3],
    });
  });

  it("counts a changed digit as a placement", () => {
    const empty = parsePuzzle(".".repeat(81));
    const a = withValue(empty, 0, 0, 1);
    const b = withValue(a, 0, 0, 2);
    expect(diffBoards(a, b).placed).toEqual([0]);
  });

  it("reports the houses a placement just completed", () => {
    const solved = parsePuzzle(SOLVED);
    const before = withValue(solved, 0, 0, null);
    // Filling r1c1 completes row 1, column 1 and box 1 at once.
    expect(
      diffBoards(before, solved).completedUnits.sort((x, y) => x - y),
    ).toEqual([0, 9, 18]);
  });

  it("does not celebrate a full house that repeats a digit", () => {
    const solved = parsePuzzle(SOLVED);
    const before = withValue(solved, 0, 0, null);
    const wrong = withValue(solved, 0, 0, 9);
    expect(diffBoards(before, wrong).completedUnits).toEqual([]);
  });
});
