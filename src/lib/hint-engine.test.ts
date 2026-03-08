import { describe, expect, it } from "vitest";
import { findHint } from "./hint-engine.ts";
import { parsePuzzle } from "./sudoku.ts";

describe("findHint", () => {
  describe("naked single", () => {
    it("detects a cell where only one candidate is possible", () => {
      // Puzzle where R1C1 (index 0) is empty and has 8 of 9 values
      // already present in its row, column, or box — leaving only one option.
      // Row 1: .234567891 → missing 1 at col 0... but we need to also
      // constrain col and box. Let's construct a near-complete board.
      //
      // Use a real puzzle where we can control which cell has a naked single.
      // Strategy: take a solved board, remove one cell → that cell is trivially
      // a naked single because it's the only empty cell.
      const solved =
        "534678912" +
        "672195348" +
        "198342567" +
        "859761423" +
        "426853791" +
        "713924856" +
        "961537284" +
        "287419635" +
        "345286179";

      // Remove cell at R0C0 (value 5) → naked single
      const puzzle = "." + solved.slice(1);
      const board = parsePuzzle(puzzle);

      const hint = findHint(board, solved);
      expect(hint).not.toBeNull();
      expect(hint!.position).toEqual({ row: 0, col: 0 });
      expect(hint!.value).toBe(5);
      expect(hint!.technique).toBe("naked-single");
      expect(hint!.explanation).toContain("5");
    });

    it("returns related cells that eliminate candidates", () => {
      const solved =
        "534678912" +
        "672195348" +
        "198342567" +
        "859761423" +
        "426853791" +
        "713924856" +
        "961537284" +
        "287419635" +
        "345286179";

      const puzzle = "." + solved.slice(1);
      const board = parsePuzzle(puzzle);

      const hint = findHint(board, solved);
      expect(hint).not.toBeNull();
      // Related cells should include cells in the same row, col, or box
      // that contribute to eliminating candidates
      expect(hint!.relatedCells.length).toBeGreaterThan(0);
    });
  });
});
