// @vitest-environment node
import { describe, expect, it } from "vitest";
import { gradePuzzle } from "./grader.ts";

// Fixtures verified uniquely-solvable via countSolutions when pinned.
const SINGLES_ONLY =
  "674392...1..47..323.2.81.7...68.9.2581972....5.....189.48..3.......5...17...483.6";
const NEEDS_PAIRS =
  "5.....3.....8..46.6..57..9..7.........31.5..8..1.....9.97.1.58....4.2.......5..4.";
const NEEDS_TRIPLES =
  "57....8....87..........8.346...59.....5....9...72..........6.7...1....899.684...1";
// Mined from hard-band digs: stuck under tiers 1-3, solved once quads,
// XY-wings, and swordfish join the ladder.
const NEEDS_ADVANCED =
  "....1..7.3.1......5682.....68...9..2.15.8.4.........97.....7.6.....2......9.51.4.";
// AI Escargot — famously requires forcing chains beyond every rung.
const NEEDS_CHAINS =
  "1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..";

describe("gradePuzzle", () => {
  it("grades a puzzle that falls to singles alone as tier 1", () => {
    expect(gradePuzzle(SINGLES_ONLY)).toEqual({ tier: 1, stuckCells: 0 });
  });

  it("grades a puzzle needing pairs or locked candidates as tier 2", () => {
    expect(gradePuzzle(NEEDS_PAIRS)).toEqual({ tier: 2, stuckCells: 0 });
  });

  it("grades a puzzle needing triples or an X-wing as tier 3", () => {
    expect(gradePuzzle(NEEDS_TRIPLES)).toEqual({ tier: 3, stuckCells: 0 });
  });

  it("grades a puzzle needing quads, XY-wings, or swordfish as tier 4", () => {
    expect(gradePuzzle(NEEDS_ADVANCED)).toEqual({ tier: 4, stuckCells: 0 });
  });

  it("grades a chains-only puzzle tier 5 with a deep stuck count", () => {
    const grade = gradePuzzle(NEEDS_CHAINS);
    expect(grade.tier).toBe(5);
    // Most of the board must still be open when the techniques run
    // dry — the severity signal expert generation selects on.
    expect(grade.stuckCells).toBeGreaterThanOrEqual(40);
  });

  it("treats a malformed puzzle as maximally stuck", () => {
    expect(gradePuzzle("123")).toEqual({ tier: 5, stuckCells: 81 });
  });

  it("treats a contradictory puzzle as maximally stuck", () => {
    // Cell (0,8) sees 1-8 in its row and 9 in its column: no candidate
    // remains, though no two givens clash directly.
    const contradictory = `12345678.........9${".".repeat(63)}`;
    expect(gradePuzzle(contradictory)).toEqual({ tier: 5, stuckCells: 81 });
  });
});
