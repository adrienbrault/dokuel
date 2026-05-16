import { describe, expect, it } from "vitest";
import { applyStepToBoard } from "./apply-step.ts";
import { demo } from "./builders.ts";

const EMPTY_PUZZLE = ".".repeat(81);

describe("applyStepToBoard", () => {
  it("renders givens from the puzzle as isGiven cells with their value", () => {
    const puzzle = "5".padEnd(81, ".");
    const d = demo("x", "Example").puzzle(puzzle).step("a").build();
    const board = applyStepToBoard(d, d.steps[0]!);

    expect(board[0]![0]!.value).toBe(5);
    expect(board[0]![0]!.isGiven).toBe(true);
    expect(board[0]![0]!.notes.size).toBe(0);
  });

  it("renders placements as filled non-given cells with empty notes", () => {
    const d = demo("x", "Example")
      .puzzle(EMPTY_PUZZLE)
      .step("place")
      .place(0, 0, 5)
      .build();
    const board = applyStepToBoard(d, d.steps[0]!);

    expect(board[0]![0]!.value).toBe(5);
    expect(board[0]![0]!.isGiven).toBe(false);
    expect(board[0]![0]!.notes.size).toBe(0);
  });

  it("writes the demo's initial candidates as notes on empty cells", () => {
    const d = demo("x", "Example")
      .puzzle(EMPTY_PUZZLE)
      .restrict([0, 0], [4, 7])
      .step("show")
      .build();
    const board = applyStepToBoard(d, d.steps[0]!);

    expect(board[0]![0]!.value).toBeNull();
    expect(board[0]![0]!.notes).toEqual(new Set([4, 7]));
  });
});
