// @vitest-environment node
import { describe, expect, it } from "vitest";
import { initCandidates } from "./candidates.ts";
import { solvePuzzle } from "./sudoku.ts";
import { swordfish, xyWing } from "./wings.ts";

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

  it("reports each pattern cell's candidate pair for the hint", () => {
    // Without the roles a player cannot follow the wing: the pivot
    // does not even contain the eliminated digit, so a hint naming
    // only that digit sends their eyes to the wrong cells.
    const s = initCandidates(XYWING_STATE)!;
    const elim = xyWing(s)!;
    const z = elim.digits[0]!;

    const [pivot, pincer1, pincer2] = elim.patternDigits!;
    expect(pivot).toHaveLength(2);
    expect(pivot).not.toContain(z);
    for (const pincer of [pincer1!, pincer2!]) {
      expect(pincer).toHaveLength(2);
      expect(pincer).toContain(z);
      // Each pincer covers one pivot digit; together they cover both.
      expect(pivot!.filter((d) => pincer.includes(d))).toHaveLength(1);
    }
    expect(pincer1!.filter((d) => pincer2!.includes(d))).toEqual([z]);
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
