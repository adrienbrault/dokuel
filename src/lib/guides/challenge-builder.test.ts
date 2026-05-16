import { describe, expect, it } from "vitest";
import { cellKey } from "../sudoku.ts";
import { challenge } from "./challenge-builder.ts";

const EMPTY_PUZZLE = ".".repeat(81);

describe("challenge() builder", () => {
  it("builds a place challenge with the expected answer", () => {
    const c = challenge("c1", "Place the digit.")
      .puzzle(EMPTY_PUZZLE)
      .place([0, 0], 7)
      .explain("Only legal value.")
      .build();

    expect(c.id).toBe("c1");
    expect(c.prompt).toBe("Place the digit.");
    expect(c.question).toEqual({
      kind: "place",
      cell: { row: 0, col: 0 },
      value: 7,
    });
    expect(c.explanation).toBe("Only legal value.");
  });

  it("builds a select-cells challenge with normalized positions", () => {
    const c = challenge("c2", "Tap the pair.")
      .puzzle(EMPTY_PUZZLE)
      .selectCells([
        [0, 1],
        [0, 2],
      ])
      .explain("They form the Naked Pair.")
      .build();

    expect(c.question).toEqual({
      kind: "select-cells",
      cells: [
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ],
    });
  });

  it("builds an eliminate challenge and applies restricts to initialCandidates", () => {
    const c = challenge("c3", "Which digit drops?")
      .puzzle(EMPTY_PUZZLE)
      .restrict([3, 4], [2, 5, 7])
      .eliminateAnswer([3, 4], [5])
      .explain("5 is restricted.")
      .build();

    expect(c.question).toEqual({
      kind: "eliminate",
      cell: { row: 3, col: 4 },
      digits: [5],
    });
    expect(c.initialCandidates.get(cellKey(3, 4))).toEqual(new Set([2, 5, 7]));
  });
});
