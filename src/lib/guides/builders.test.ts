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

  it("restrict overrides initial candidates so authored cells show only the listed digits", () => {
    const result = demo("x", "Example")
      .puzzle(EMPTY_PUZZLE)
      .restrict([0, 0], [4, 7])
      .build();

    expect(result.initialCandidates.get(cellKey(0, 0))).toEqual(
      new Set([4, 7]),
    );
    // Untouched cells still get the auto-computed full candidate set.
    expect(result.initialCandidates.get(cellKey(0, 1))?.size).toBe(9);
  });

  it("place records the placement this step and strips the value from peers next step", () => {
    const result = demo("x", "Example")
      .puzzle(EMPTY_PUZZLE)
      .step("Place 5 at (0,0).")
      .place(0, 0, 5)
      .step("Next.")
      .build();

    // Step 0 carries a solution overlay on the placed cell.
    expect(result.steps[0]!.overlays.get(cellKey(0, 0))).toEqual([
      { kind: "solution", digits: [5] },
    ]);
    // Step 0 has the placement (visible immediately).
    expect(result.steps[0]!.placements?.get(cellKey(0, 0))).toBe(5);
    // Step 1 still has the placement (cumulative across steps).
    expect(result.steps[1]!.placements?.get(cellKey(0, 0))).toBe(5);
    // Step 1's candidates for a peer cell (0,1) no longer include 5.
    const peerCandidates =
      result.steps[1]!.candidates?.get(cellKey(0, 1)) ??
      result.initialCandidates.get(cellKey(0, 1));
    expect(peerCandidates?.has(5)).toBe(false);
  });

  it("eliminate paints an eliminate overlay this step and removes the digit from later steps", () => {
    const result = demo("x", "Example")
      .puzzle(EMPTY_PUZZLE)
      .step("Eliminate 4 from (0,3).")
      .eliminate([[0, 3]], [4])
      .step("Next.")
      .build();

    // Step 0 carries the eliminate overlay with the targeted digits.
    expect(result.steps[0]!.overlays.get(cellKey(0, 3))).toEqual([
      { kind: "eliminate", digits: [4] },
    ]);
    // Step 0's candidates for (0,3) still include 4 — the user sees the digit
    // being struck out this step. (No override means inherit from initial,
    // which on an empty puzzle is 1..9.)
    const step0Candidates =
      result.steps[0]!.candidates?.get(cellKey(0, 3)) ??
      result.initialCandidates.get(cellKey(0, 3));
    expect(step0Candidates).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]));
    // Step 1 reflects the elimination — 4 is gone.
    const step1Candidates =
      result.steps[1]!.candidates?.get(cellKey(0, 3)) ??
      result.initialCandidates.get(cellKey(0, 3));
    expect(step1Candidates).toEqual(new Set([1, 2, 3, 5, 6, 7, 8, 9]));
  });

  it("highlightRow / highlightCol / highlightBox add unit overlays to every cell in the unit", () => {
    const result = demo("x", "Example")
      .puzzle(EMPTY_PUZZLE)
      .step("Scan row 0, column 4, and box 4.")
      .highlightRow(0)
      .highlightCol(4)
      .highlightBox(4)
      .build();

    const overlays = result.steps[0]!.overlays;
    // Row 0 cells all have unit overlays.
    for (let c = 0; c < 9; c++) {
      expect(overlays.get(cellKey(0, c))).toContainEqual({ kind: "unit" });
    }
    // Column 4 cells all have unit overlays.
    for (let r = 0; r < 9; r++) {
      expect(overlays.get(cellKey(r, 4))).toContainEqual({ kind: "unit" });
    }
    // Box 4 (rows 3-5, cols 3-5) cells all have unit overlays.
    for (let r = 3; r < 6; r++) {
      for (let c = 3; c < 6; c++) {
        expect(overlays.get(cellKey(r, c))).toContainEqual({ kind: "unit" });
      }
    }
    // A cell outside all three units has no overlay entry.
    expect(overlays.has(cellKey(8, 8))).toBe(false);
  });

  it("appends a step with caption and focus overlays on listed cells", () => {
    const result = demo("x", "Example")
      .puzzle(EMPTY_PUZZLE)
      .step("Spot the pair.")
      .focus([
        [2, 3],
        [2, 7],
      ])
      .build();

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]!.caption).toBe("Spot the pair.");
    expect(result.steps[0]!.overlays.get(cellKey(2, 3))).toEqual([
      { kind: "focus" },
    ]);
    expect(result.steps[0]!.overlays.get(cellKey(2, 7))).toEqual([
      { kind: "focus" },
    ]);
  });
});
