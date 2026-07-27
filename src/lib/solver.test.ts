import { describe, expect, it } from "vitest";
import { countSolutions, solve } from "./solver.ts";

// The canonical Wikipedia example puzzle — unique solution, verified by hand.
const WIKI_PUZZLE =
  "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
const WIKI_SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

// Two givens that directly conflict (two 5s in row 0) — zero solutions.
const UNSOLVABLE_PUZZLE = `55${".".repeat(79)}`;

// Almost no constraints — many solutions.
const AMBIGUOUS_PUZZLE = `12${".".repeat(79)}`;

describe("solve", () => {
  it("solves a known puzzle to its unique solution", () => {
    expect(solve(WIKI_PUZZLE)).toBe(WIKI_SOLUTION);
  });

  it("returns null when the givens conflict", () => {
    expect(solve(UNSOLVABLE_PUZZLE)).toBeNull();
  });

  it("returns null for a malformed puzzle string", () => {
    expect(solve("123")).toBeNull();
    expect(solve(`0${".".repeat(80)}`)).toBeNull();
    expect(solve(`x${".".repeat(80)}`)).toBeNull();
  });

  it("solves an already-complete grid to itself", () => {
    expect(solve(WIKI_SOLUTION)).toBe(WIKI_SOLUTION);
  });
});

describe("countSolutions", () => {
  it("returns 1 for a puzzle with a unique solution", () => {
    expect(countSolutions(WIKI_PUZZLE)).toBe(1);
  });

  it("returns 0 when the givens conflict", () => {
    expect(countSolutions(UNSOLVABLE_PUZZLE)).toBe(0);
  });

  it("returns 0 for a malformed puzzle string", () => {
    expect(countSolutions("not a puzzle")).toBe(0);
  });

  it("caps counting at 2 by default for ambiguous puzzles", () => {
    expect(countSolutions(AMBIGUOUS_PUZZLE)).toBe(2);
  });

  it("honors a custom cap", () => {
    expect(countSolutions(AMBIGUOUS_PUZZLE, 5)).toBe(5);
  });

  it("returns 1 for a fully solved grid", () => {
    expect(countSolutions(WIKI_SOLUTION)).toBe(1);
  });
});
