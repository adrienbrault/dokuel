// @vitest-environment node
import { describe, expect, it } from "vitest";
import { initCandidates } from "./candidates.ts";
import { solvePuzzle } from "./sudoku.ts";
import { findUnlockingPlacement, swordfish, xyWing } from "./techniques.ts";

// Boards captured by playing naked/hidden singles to exhaustion on
// graded puzzles — the exact state a stuck player faces. Verified
// uniquely solvable when pinned.
const PAIRS_STUCK =
  "5.....3277.982.4656..57.891.7....1.49.31.5.78..1..7..9497.1.5823..4927161..758943";
const CHAINS_STUCK =
  "..982..454....5982582.9..372.8...519154982376.9.5.14289.7...8513657182948.1.59763";

describe("xyWing", () => {
  // Mined from a graded solve: no single is available on this board,
  // but an XY-wing fires on freshly computed candidates.
  const XYWING_STATE =
    "3.42.1.69..6.8.....5..63...541...79663.....5.7....6341.....5......6.791........74";

  it("eliminates the pincers' shared digit from cells seeing both", () => {
    const s = initCandidates(XYWING_STATE)!;
    const elim = xyWing(s);

    expect(elim).not.toBeNull();
    expect(elim!.kind).toBe("xy-wing");
    expect(elim!.patternCells).toHaveLength(3);
    expect(elim!.digits).toHaveLength(1);
    expect(elim!.removed.length).toBeGreaterThan(0);
    // Soundness: no removal may strip the solution's own digit.
    const solution = solvePuzzle(XYWING_STATE)!;
    for (const r of elim!.removed) {
      expect(r.digit).not.toBe(Number(solution[r.cell]));
    }
  });
});

describe("swordfish", () => {
  const SWORDFISH_STATE =
    "....1..3519.3.........64...4.65..1......9...89..1..25....7.856.5.8............48.";

  it("clears the digit from the crossing lines outside the fish", () => {
    const s = initCandidates(SWORDFISH_STATE)!;
    const elim = swordfish(s);

    expect(elim).not.toBeNull();
    expect(elim!.kind).toBe("swordfish");
    expect(elim!.digits).toHaveLength(1);
    expect(elim!.removed.length).toBeGreaterThan(0);
    const solution = solvePuzzle(SWORDFISH_STATE)!;
    for (const r of elim!.removed) {
      expect(r.digit).toBe(elim!.digits[0]);
      expect(r.digit).not.toBe(Number(solution[r.cell]));
    }
  });
});

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
