// @vitest-environment node
import { describe, expect, it } from "vitest";
import { solvePuzzle } from "./sudoku.ts";
import { findUnlockingPlacement } from "./techniques.ts";

// Boards captured by playing naked/hidden singles to exhaustion on
// graded puzzles — the exact state a stuck player faces. Verified
// uniquely solvable when pinned.
const PAIRS_STUCK =
  "5.....3277.982.4656..57.891.7....1.49.31.5.78..1..7..9497.1.5823..4927161..758943";
const CHAINS_STUCK =
  "..982..454....5982582.9..372.8...519154982376.9.5.14289.7...8513657182948.1.59763";

describe("findUnlockingPlacement", () => {
  it("finds the elimination that unlocks the next placement", () => {
    const unlock = findUnlockingPlacement(PAIRS_STUCK);
    expect(unlock).not.toBeNull();
    const { elimination, single } = unlock!;
    expect(elimination.patternCells.length).toBeGreaterThan(0);
    expect(elimination.removed.length).toBeGreaterThan(0);
    // The unlocked placement must match the puzzle's actual solution.
    const solution = solvePuzzle(PAIRS_STUCK)!;
    expect(single.digit).toBe(Number(solution[single.cell]));
  });

  it("returns null when only chains can progress", () => {
    expect(findUnlockingPlacement(CHAINS_STUCK)).toBeNull();
  });

  it("returns null when a single is already available", () => {
    // Precondition guard: the hint engine explains singles itself with
    // richer wording; this path must not shadow them.
    const nearlyDone = `.${solvePuzzle(PAIRS_STUCK)!.slice(1)}`;
    expect(findUnlockingPlacement(nearlyDone)).toBeNull();
  });
});
