import { describe, expect, it } from "vitest";
import { cellKey } from "../sudoku.ts";
import { demo } from "./builders.ts";

const EMPTY_PUZZLE = ".".repeat(81);

describe("demo() builder", () => {
  it("builds a Demo with id, title, puzzle, and no steps when none are added", () => {
    const result = demo("x", "Example").puzzle(EMPTY_PUZZLE).build();

    expect(result.id).toBe("x");
    expect(result.title).toBe("Example");
    expect(result.puzzle).toBe(EMPTY_PUZZLE);
    expect(result.steps).toEqual([]);
  });

  it("auto-populates initialCandidates with legal digits for every empty cell", () => {
    const puzzle = "12345678..".padEnd(81, ".");
    const result = demo("x", "Example").puzzle(puzzle).build();

    // Cell (0,8) is empty in the first row that already contains 1-8;
    // the only legal candidate is 9.
    expect(result.initialCandidates.get(cellKey(0, 8))).toEqual(new Set([9]));
    // A given cell has no candidates entry.
    expect(result.initialCandidates.has(cellKey(0, 0))).toBe(false);
  });
});
