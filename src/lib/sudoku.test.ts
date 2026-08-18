// @vitest-environment node
import { describe, expect, it } from "vitest";
import { seededRandom } from "./daily.ts";
import { gradePuzzle } from "./grader.ts";
import { countSolutions } from "./solver.ts";
import {
  cellKey,
  generatePuzzle,
  generatePuzzleWithSolution,
  getConflicts,
  getErrors,
  isBoardComplete,
  parsePuzzle,
  solvePuzzle,
} from "./sudoku.ts";
import type { Board } from "./types.ts";

// A known valid puzzle and its solution — avoids calling generatePuzzle in every test
const KNOWN_PUZZLE =
  "..4.7...2....89...8...6.9....6...54.7.....3..1............974...2..18.....3..5.6.";
const KNOWN_SOLUTION =
  "594173682267589134831462957386721549742956318159834276618397425425618793973245861";

describe("generatePuzzle", () => {
  it("returns an 81-character string", () => {
    const puzzle = generatePuzzle("medium");
    expect(puzzle).toHaveLength(81);
  });

  it("generates uniquely-solvable puzzles at every difficulty", () => {
    // The old clue-stripping approach produced multi-solution boards for
    // 45% of hard and 100% of expert puzzles. Uniqueness is the contract
    // that makes error-highlighting and hints trustworthy.
    for (const difficulty of ["easy", "medium", "hard", "expert"] as const) {
      for (let i = 0; i < 3; i++) {
        expect(countSolutions(generatePuzzle(difficulty))).toBe(1);
      }
    }
  });

  it("respects the clue bands per difficulty", () => {
    const bands = {
      easy: { min: 36, max: 45 },
      medium: { min: 28, max: 35 },
      hard: { min: 24, max: 27 },
      // Expert digs to a minimal puzzle; random digging exhausts at
      // roughly 22-28 clues, always above the theoretical floor of 17.
      expert: { min: 17, max: 28 },
    } as const;
    for (const difficulty of ["easy", "medium", "hard", "expert"] as const) {
      const clues = generatePuzzle(difficulty).replace(/\./g, "").length;
      expect(clues).toBeGreaterThanOrEqual(bands[difficulty].min);
      expect(clues).toBeLessThanOrEqual(bands[difficulty].max);
    }
  });

  it("contains only digits 0-9 and dots for empty cells", () => {
    const puzzle = generatePuzzle("medium");
    expect(puzzle).toMatch(/^[1-9.]{81}$/);
  });

  it("has more clues for easier difficulties", () => {
    const easy = generatePuzzle("easy");
    const expert = generatePuzzle("expert");
    const easyClues = easy.replace(/\./g, "").length;
    const expertClues = expert.replace(/\./g, "").length;
    expect(easyClues).toBeGreaterThan(expertClues);
  });

  it("generates different puzzles on each call", () => {
    const a = generatePuzzle("medium");
    const b = generatePuzzle("medium");
    expect(a).not.toBe(b);
  });

  it("is deterministic when given a seeded rng", () => {
    expect(generatePuzzle("hard", seededRandom(5))).toBe(
      generatePuzzle("hard", seededRandom(5)),
    );
  });

  // Clue count alone is a weak difficulty signal — half the puzzles in
  // the hard clue band fall to singles. These bars are the actual
  // difficulty contract: hard must demand advanced techniques, expert
  // must defeat them outright across most of the board.
  it("medium never demands more than pairs and locked candidates", () => {
    // These seeds produced chains-grade boards under clue-band-only
    // digging — a "medium" a player could not finish without guessing.
    for (const seed of [6, 18, 19]) {
      const grade = gradePuzzle(generatePuzzle("medium", seededRandom(seed)));
      expect(grade.tier).toBeLessThanOrEqual(2);
    }
  });

  it("hard demands advanced techniques and never needs chains", () => {
    // The chain-free guarantee: every hard board must be solvable
    // start to finish on the ladder (stuckCells 0), while demanding
    // at least tier 3 so it stays genuinely hard.
    for (const seed of [1, 2, 3]) {
      const grade = gradePuzzle(generatePuzzle("hard", seededRandom(seed)));
      expect(grade.tier).toBeGreaterThanOrEqual(3);
      expect(grade.stuckCells).toBe(0);
    }
  });

  it("expert defeats every graded technique across most of the board", () => {
    for (const seed of [1, 2, 3]) {
      const grade = gradePuzzle(generatePuzzle("expert", seededRandom(seed)));
      expect(grade.tier).toBe(5);
      expect(grade.stuckCells).toBeGreaterThanOrEqual(40);
    }
  });

  it("still ships a valid board when the grade bar is unreachable", () => {
    // A constant rng makes every dig identical, so the graded loop can
    // never meet its bar — generation must fall back to the best board
    // seen instead of blocking the UI.
    const puzzle = generatePuzzle("expert", () => 0);
    expect(puzzle).toMatch(/^[1-9.]{81}$/);
    expect(countSolutions(puzzle)).toBe(1);
  });
});

describe("generatePuzzleWithSolution", () => {
  it("returns the solution the puzzle was dug from", () => {
    const { puzzle, solution } = generatePuzzleWithSolution("medium");
    expect(solution).toMatch(/^[1-9]{81}$/);
    for (let i = 0; i < 81; i++) {
      if (puzzle[i] !== ".") {
        expect(puzzle[i]).toBe(solution[i]);
      }
    }
    expect(countSolutions(solution)).toBe(1);
  });
});

describe("solvePuzzle", () => {
  it("returns null for malformed input instead of throwing", () => {
    expect(solvePuzzle("123")).toBeNull();
    expect(solvePuzzle(`x${".".repeat(80)}`)).toBeNull();
  });

  it("returns null for an unsolvable puzzle", () => {
    expect(solvePuzzle(`55${".".repeat(79)}`)).toBeNull();
  });

  it("returns a valid 81-character solution", () => {
    const solution = solvePuzzle(KNOWN_PUZZLE);
    expect(solution).toHaveLength(81);
    expect(solution).toMatch(/^[1-9]{81}$/);
  });

  it("solution contains all digits 1-9 in each row", () => {
    const solution = solvePuzzle(KNOWN_PUZZLE)!;
    for (let row = 0; row < 9; row++) {
      const digits = solution.slice(row * 9, row * 9 + 9).split("");
      expect(new Set(digits).size).toBe(9);
    }
  });

  it("solution contains all digits 1-9 in each column", () => {
    const solution = solvePuzzle(KNOWN_PUZZLE)!;
    for (let col = 0; col < 9; col++) {
      const digits: string[] = [];
      for (let row = 0; row < 9; row++) {
        digits.push(solution[row * 9 + col]!);
      }
      expect(new Set(digits).size).toBe(9);
    }
  });

  it("preserves given clues from the puzzle", () => {
    const solution = solvePuzzle(KNOWN_PUZZLE)!;
    for (let i = 0; i < 81; i++) {
      if (KNOWN_PUZZLE[i] !== ".") {
        expect(solution[i]).toBe(KNOWN_PUZZLE[i]);
      }
    }
  });
});

describe("parsePuzzle", () => {
  it("returns a 9x9 board", () => {
    const board = parsePuzzle(KNOWN_PUZZLE);
    expect(board).toHaveLength(9);
    for (const row of board) {
      expect(row).toHaveLength(9);
    }
  });

  it("marks given cells correctly", () => {
    const board = parsePuzzle(KNOWN_PUZZLE);
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const char = KNOWN_PUZZLE[row * 9 + col];
        if (char !== ".") {
          expect(board[row]![col]!.isGiven).toBe(true);
          expect(board[row]![col]!.value).toBe(Number(char));
        } else {
          expect(board[row]![col]!.isGiven).toBe(false);
          expect(board[row]![col]!.value).toBeNull();
        }
      }
    }
  });

  it("initializes empty notes for all cells", () => {
    const board = parsePuzzle(KNOWN_PUZZLE);
    for (const row of board) {
      for (const cell of row) {
        expect(cell.notes).toBeInstanceOf(Set);
        expect(cell.notes.size).toBe(0);
      }
    }
  });
});

describe("getConflicts", () => {
  it("returns empty set when no conflicts", () => {
    const board = parsePuzzle(KNOWN_SOLUTION);
    const conflicts = getConflicts(board);
    expect(conflicts.size).toBe(0);
  });

  it("detects row conflict", () => {
    const board = makeEmptyBoard();
    board[0]![0]!.value = 5;
    board[0]![4]!.value = 5;
    const conflicts = getConflicts(board);
    expect(conflicts.has(cellKey(0, 0))).toBe(true);
    expect(conflicts.has(cellKey(0, 4))).toBe(true);
  });

  it("detects column conflict", () => {
    const board = makeEmptyBoard();
    board[0]![0]!.value = 3;
    board[5]![0]!.value = 3;
    const conflicts = getConflicts(board);
    expect(conflicts.has(cellKey(0, 0))).toBe(true);
    expect(conflicts.has(cellKey(5, 0))).toBe(true);
  });

  it("detects box conflict", () => {
    const board = makeEmptyBoard();
    board[0]![0]!.value = 7;
    board[2]![2]!.value = 7;
    const conflicts = getConflicts(board);
    expect(conflicts.has(cellKey(0, 0))).toBe(true);
    expect(conflicts.has(cellKey(2, 2))).toBe(true);
  });

  it("does not flag non-conflicting cells", () => {
    const board = makeEmptyBoard();
    board[0]![0]!.value = 1;
    board[0]![1]!.value = 2;
    board[1]![0]!.value = 3;
    const conflicts = getConflicts(board);
    expect(conflicts.size).toBe(0);
  });
});

describe("getErrors", () => {
  it("returns empty set when all user values match the solution", () => {
    const board = parsePuzzle(KNOWN_PUZZLE);
    // Fill in all empty cells with the correct solution values
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (!board[row]![col]!.isGiven) {
          board[row]![col]!.value = Number(KNOWN_SOLUTION[row * 9 + col]);
        }
      }
    }
    const errors = getErrors(board, KNOWN_SOLUTION);
    expect(errors.size).toBe(0);
  });

  it("flags a cell whose value differs from the solution", () => {
    const board = parsePuzzle(KNOWN_PUZZLE);
    // KNOWN_SOLUTION[0] is '5', so cell (0,0) is given as 5 — find an empty cell
    // Cell (0,0) is '.', so it's empty. Solution value is '5'.
    board[0]![0]!.value = 9; // wrong value (solution is 5)
    const errors = getErrors(board, KNOWN_SOLUTION);
    expect(errors.has(cellKey(0, 0))).toBe(true);
  });

  it("does not flag given cells even if they appear in the check", () => {
    const board = parsePuzzle(KNOWN_PUZZLE);
    // Given cells should never be flagged
    const errors = getErrors(board, KNOWN_SOLUTION);
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (board[row]![col]!.isGiven) {
          expect(errors.has(cellKey(row, col))).toBe(false);
        }
      }
    }
  });

  it("does not flag empty cells", () => {
    const board = parsePuzzle(KNOWN_PUZZLE);
    const errors = getErrors(board, KNOWN_SOLUTION);
    expect(errors.size).toBe(0);
  });
});

describe("isBoardComplete", () => {
  it("returns true for a fully solved board", () => {
    const board = parsePuzzle(KNOWN_SOLUTION);
    expect(isBoardComplete(board)).toBe(true);
  });

  it("returns false when cells are empty", () => {
    const board = parsePuzzle(KNOWN_PUZZLE);
    expect(isBoardComplete(board)).toBe(false);
  });

  it("returns false when there are conflicts even if all filled", () => {
    const board = makeEmptyBoard();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        board[r]![c]!.value = 1;
      }
    }
    expect(isBoardComplete(board)).toBe(false);
  });
});

function makeEmptyBoard(): Board {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => ({
      value: null,
      isGiven: false,
      notes: new Set<number>(),
    })),
  );
}
