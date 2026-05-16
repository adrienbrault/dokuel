import { describe, expect, it } from "vitest";
import { initState, projectBoard, serializeBoard } from "./board-engine.ts";
import { cellKey } from "./sudoku.ts";

describe("serializeBoard", () => {
  it("round-trips through initState", () => {
    const puzzle =
      "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
    const fresh = initState({ puzzle }).board;
    fresh[0]![2]!.value = 4;
    fresh[0]![3]!.notes = new Set([1, 2, 9]);
    fresh[8]![6]!.notes = new Set([3]);

    const saved = serializeBoard(fresh);
    const restored = initState({ puzzle, savedBoard: saved }).board;

    expect(serializeBoard(restored)).toEqual(saved);
    expect(restored[0]![2]!.value).toBe(4);
    expect([...restored[0]![3]!.notes].sort()).toEqual([1, 2, 9]);
    expect([...restored[8]![6]!.notes]).toEqual([3]);
  });

  it("encodes empty cells as '.' and preserves given cells", () => {
    const puzzle =
      "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
    const board = initState({ puzzle }).board;
    const { values } = serializeBoard(board);
    expect(values).toBe(puzzle);
  });
});

describe("projectBoard", () => {
  const puzzle =
    "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";

  it("counts empty cells and remaining digits on an unmodified puzzle", () => {
    const board = initState({ puzzle }).board;
    const empties = puzzle.split("").filter((c) => c === ".").length;
    const projection = projectBoard(board);
    expect(projection.cellsRemaining).toBe(empties);
    // remainingCounts for each digit = 9 minus its givens
    for (let d = 1; d <= 9; d++) {
      const givens = puzzle.split("").filter((c) => c === String(d)).length;
      expect(projection.remainingCounts[d]).toBe(9 - givens);
    }
  });

  it("flags both cells of a row conflict", () => {
    const board = initState({ puzzle }).board;
    // Row 0 already has a 7; place another 7 elsewhere in row 0.
    board[0]![2]!.value = 7;
    const { conflicts } = projectBoard(board);
    expect(conflicts.has(cellKey(0, 2))).toBe(true);
    expect(conflicts.has(cellKey(0, 4))).toBe(true);
  });

  it("returns no errors when solution is omitted", () => {
    const board = initState({ puzzle }).board;
    board[0]![2]!.value = 9;
    expect(projectBoard(board).errors.size).toBe(0);
  });

  it("flags errors against a supplied solution", () => {
    const board = initState({ puzzle }).board;
    // Correct value at (0,2) is 4; insert wrong value 9.
    const solution =
      "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
    board[0]![2]!.value = 9;
    const { errors } = projectBoard(board, solution);
    expect(errors.has(cellKey(0, 2))).toBe(true);
  });
});
