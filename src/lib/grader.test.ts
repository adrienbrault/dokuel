// @vitest-environment node
import { describe, expect, it } from "vitest";
import { gradePuzzle } from "./grader.ts";

// Fixture verified uniquely-solvable via countSolutions when pinned.
const SINGLES_ONLY =
  "674392...1..47..323.2.81.7...68.9.2581972....5.....189.48..3.......5...17...483.6";

describe("gradePuzzle", () => {
  it("grades a puzzle that falls to singles alone as tier 1", () => {
    expect(gradePuzzle(SINGLES_ONLY)).toEqual({ tier: 1, stuckCells: 0 });
  });
});
