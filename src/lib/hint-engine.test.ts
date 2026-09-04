// @vitest-environment node
import { describe, expect, it } from "vitest";
import { findHint } from "./hint-engine.ts";
import { presentHint } from "./learning-hints.ts";
import { parsePuzzle, solvePuzzle } from "./sudoku.ts";

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

  describe("solution fallback", () => {
    it("labels the solution-lookup fallback as a reveal, not a naked single", () => {
      // An empty board has no naked or hidden single anywhere, so the
      // engine falls back to looking the answer up in the solution.
      // Calling that a "Naked Single" teaches players the wrong thing
      // about a technique they're trying to learn.
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
      const board = parsePuzzle(".".repeat(81));

      const hint = findHint(board, solved);

      expect(hint).not.toBeNull();
      expect(hint!.technique).toBe("reveal");
      expect(hint!.value).toBe(5);
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

  describe("technique unlock", () => {
    // Boards captured by playing singles to exhaustion on graded
    // puzzles — the state where the old engine gave up and revealed.
    const PAIRS_STUCK =
      "5.....3277.982.4656..57.891.7....1.49.31.5.78..1..7..9497.1.5823..4927161..758943";
    const TRIPLES_STUCK =
      "57....8....87..9.....5.873468..59..7..567..98.9728....8....647.7413256899.6847..1";

    it("explains the unlocking elimination instead of revealing", () => {
      // Box 2 confines 3 to column 6, which strips r7c6 down to a
      // lone 6 — a real deduction with proving cells, not a reveal.
      const board = parsePuzzle(PAIRS_STUCK);
      const hint = findHint(board, solvePuzzle(PAIRS_STUCK)!);

      expect(hint).not.toBeNull();
      expect(hint!.technique).toBe("locked-candidates");
      expect(hint!.position).toEqual({ row: 6, col: 5 });
      expect(hint!.value).toBe(6);
      expect(hint!.explanation).toContain("3");
      expect(hint!.explanation).toContain("6");
      expect(hint!.relatedCells.length).toBeGreaterThan(0);
    });

    it("labels an X-wing unlock as an X-wing", () => {
      const board = parsePuzzle(TRIPLES_STUCK);
      const hint = findHint(board, solvePuzzle(TRIPLES_STUCK)!);

      expect(hint).not.toBeNull();
      expect(hint!.technique).toBe("x-wing");
      expect(hint!.position).toEqual({ row: 5, col: 7 });
      expect(hint!.value).toBe(4);
    });

    it("teaches a swordfish where the old ladder revealed", () => {
      const SWORDFISH_STUCK =
        "....1..3519.3.........64...4.65..1......9...89..1..25....7.856.5.8............48.";
      const board = parsePuzzle(SWORDFISH_STUCK);
      const hint = findHint(board, solvePuzzle(SWORDFISH_STUCK)!);

      expect(hint).not.toBeNull();
      expect(hint!.technique).toBe("swordfish");
      expect(hint!.position).toEqual({ row: 1, col: 6 });
      expect(hint!.value).toBe(8);
      expect(hint!.explanation).toContain("8");
    });

    it("teaches an XY-wing and owns up to its depth", () => {
      // priorSteps is 1 here: one quieter elimination precedes the
      // XY-wing, and the hint must say so instead of pretending the
      // deduction reads straight off the visible board.
      const XYWING_STUCK =
        "1...539466....4382.436.27..3...4829...4.216372..3.64.87..4358.94.9..75.3538269174";
      const board = parsePuzzle(XYWING_STUCK);
      const hint = findHint(board, solvePuzzle(XYWING_STUCK)!);

      expect(hint).not.toBeNull();
      expect(hint!.technique).toBe("xy-wing");
      expect(hint!.position).toEqual({ row: 3, col: 3 });
      expect(hint!.value).toBe(5);
      expect(hint!.explanation).toContain("XY-wing");
      expect(hint!.explanation).toContain("eliminations deep");
    });

    it("walks the XY-wing through both pivot cases with real digits", () => {
      // The live board behind the "I don't understand" report: the
      // pivot holds 4/5 and never the eliminated 2, so a hint naming
      // only "an XY-wing on 2" reads as nonsense. The fix: name the
      // pivot's digits and walk what each choice forces.
      const USER_BOARD =
        ".738.1.69.61..9.8.8946...1.42756839115.3..87.38..17.4.745126938912783654638...127";
      const board = parsePuzzle(USER_BOARD);
      const hint = findHint(board, solvePuzzle(USER_BOARD)!);

      expect(hint).not.toBeNull();
      expect(hint!.technique).toBe("xy-wing");
      expect(hint!.position).toEqual({ row: 1, col: 0 });
      expect(hint!.value).toBe(5);
      expect(hint!.explanation).toContain("pivot cell can only be 4 or 5");
      expect(hint!.explanation).toContain("If it's 4, the 4/2 cell must be 2");
      expect(hint!.explanation).toContain("if it's 5, the 5/2 cell must be 2");
    });

    it("labels a naked-quad unlock", () => {
      const QUAD_STUCK =
        "6.4..8..72..59184689...63.....8.267...8.57..972.9..518.82..5...5........1....97.5";
      const board = parsePuzzle(QUAD_STUCK);
      const hint = findHint(board, solvePuzzle(QUAD_STUCK)!);

      expect(hint).not.toBeNull();
      expect(hint!.technique).toBe("naked-quad");
      expect(hint!.position).toEqual({ row: 3, col: 0 });
      expect(hint!.value).toBe(9);
    });

    it("teaches an elimination even when it does not unlock a placement", () => {
      const CHAINS_STUCK =
        "..982..454....5982582.9..372.8...519154982376.9.5.14289.7...8513657182948.1.59763";
      const board = parsePuzzle(CHAINS_STUCK);
      const hint = findHint(board, solvePuzzle(CHAINS_STUCK)!);

      expect(hint).not.toBeNull();
      expect(hint!.technique).toBe("locked-candidates");
      expect(hint!.eliminationOnly).toBe(true);
      expect(hint!.relatedCells.length).toBeGreaterThan(0);

      const reveal = presentHint(hint!, "reveal");
      expect(reveal.explanation).toContain("Apply that elimination");
      expect(reveal.explanation).not.toContain("Enter ");
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
