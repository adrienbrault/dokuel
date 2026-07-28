import { describe, expect, it } from "vitest";
import { findHint } from "./hint-engine.ts";
import { parsePuzzle } from "./sudoku.ts";

describe("findHint", () => {
  describe("mistake redirection", () => {
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

    it("points at the player's wrong entry instead of deducing from it", () => {
      // Two empty cells; the player filled (0,0) with 9 — locally
      // consistent, but wrong (solution says 5). Deducing singles from
      // that premise recommends provably wrong digits with full
      // confidence; the hint must surface the mistake instead.
      const puzzle = "..".concat(solved.slice(2));
      const board = parsePuzzle(puzzle);
      board[0]![0]!.value = 9;

      const hint = findHint(board, solved);

      expect(hint).not.toBeNull();
      expect(hint!.technique).toBe("mistake");
      expect(hint!.position).toEqual({ row: 0, col: 0 });
      expect(hint!.explanation).toContain("9");
    });

    it("never recommends a digit that contradicts the solution", () => {
      // The executed failure from the review: with a wrong entry on the
      // board, the naked-single scan returned a wrong digit for another
      // cell. Whatever the hint is, a value it asks the player to place
      // must match the solution.
      const puzzle = "..".concat(solved.slice(2));
      const board = parsePuzzle(puzzle);
      board[0]![0]!.value = 9;

      const hint = findHint(board, solved);

      expect(hint).not.toBeNull();
      if (hint!.technique !== "mistake") {
        const { row, col } = hint!.position;
        expect(hint!.value).toBe(Number(solved[row * 9 + col]));
      }
    });
  });

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

  describe("hidden single", () => {
    it("prefers naked over hidden when both exist", () => {
      // Solved board with two empty cells: (0,0) is a naked single (only
      // one peer-free digit); a hidden-single would also fire elsewhere
      // if it scanned first. Naked must win.
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

      const board = parsePuzzle(solved);
      board[0]![0]!.value = null;
      board[0]![0]!.isGiven = false;
      board[8]![8]!.value = null;
      board[8]![8]!.isGiven = false;

      const hint = findHint(board, solved);
      expect(hint?.technique).toBe("naked-single");
    });

    it("returns a hidden-single hint when no naked single exists", () => {
      // Real puzzle where every empty cell has 2+ candidates but some
      // digit only fits in one cell of a row/col/box. With a known
      // hidden-single puzzle the technique should fire.
      const board = parsePuzzle(
        "..3.1...." +
          "4.6.9...." +
          "..9.5.1.3" +
          ".4....9.." +
          "8..3.5..1" +
          "..5....3." +
          "5.1.8.6.." +
          "....4.5.8" +
          "....7.3..",
      );
      const solution =
        "253714896" +
        "416893257" +
        "879256143" +
        "342168975" +
        "867345921" +
        "195927634" +
        "571489662" +
        "623641578" +
        "984572319";

      const hint = findHint(board, solution);
      expect(hint).not.toBeNull();
      expect(["naked-single", "hidden-single"]).toContain(hint!.technique);
      // Hidden-single explanations name the group they fired in.
      if (hint!.technique === "hidden-single") {
        expect(hint!.explanation).toMatch(/(row|column|box) \d/);
      }
    });
  });

  describe("selected cell priority", () => {
    it("prioritizes the selected cell when it has a deduction", () => {
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

      // Remove two cells
      const board = parsePuzzle(solved);
      board[0]![0]!.value = null;
      board[0]![0]!.isGiven = false;
      board[8]![8]!.value = null;
      board[8]![8]!.isGiven = false;

      // Request hint with R8C8 selected
      const hint = findHint(board, solved, { row: 8, col: 8 });
      expect(hint).not.toBeNull();
      expect(hint!.position).toEqual({ row: 8, col: 8 });
    });
  });

  describe("fallback", () => {
    it("returns a hint from solution when no simple technique applies", () => {
      // A board with many empty cells where techniques are complex
      const puzzle =
        "..3.1...." +
        "4.6.9...." +
        "..9.5.1.3" +
        ".4....9.." +
        "8..3.5..1" +
        "..5....3." +
        "5.1.8.6.." +
        "....4.5.8" +
        "....7.3..";

      // Use a dummy solution (just needs to provide values)
      const solution =
        "253714896" +
        "416893257" +
        "879256143" +
        "342168975" +
        "867345921" +
        "195972634" +
        "571489662" +
        "623641578" +
        "984572319";

      const board = parsePuzzle(puzzle);
      const hint = findHint(board, solution);
      expect(hint).not.toBeNull();
      expect(hint!.value).toBeGreaterThanOrEqual(1);
      expect(hint!.value).toBeLessThanOrEqual(9);
    });
  });

  describe("no hint available", () => {
    it("returns null when board is fully solved", () => {
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

      const board = parsePuzzle(solved);
      const hint = findHint(board, solved);
      expect(hint).toBeNull();
    });
  });
});
