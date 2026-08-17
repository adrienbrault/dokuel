// @vitest-environment node
import { describe, expect, it } from "vitest";
import { gradePuzzle } from "./grader.ts";

// Fixtures verified uniquely-solvable via countSolutions when pinned.
const SINGLES_ONLY =
  "674392...1..47..323.2.81.7...68.9.2581972....5.....189.48..3.......5...17...483.6";
const NEEDS_PAIRS =
  "5.....3.....8..46.6..57..9..7.........31.5..8..1.....9.97.1.58....4.2.......5..4.";

describe("gradePuzzle", () => {
  it("grades a puzzle that falls to singles alone as tier 1", () => {
    expect(gradePuzzle(SINGLES_ONLY)).toEqual({ tier: 1, stuckCells: 0 });
  });

  it("grades a puzzle needing pairs or locked candidates as tier 2", () => {
    expect(gradePuzzle(NEEDS_PAIRS)).toEqual({ tier: 2, stuckCells: 0 });
  });
});
