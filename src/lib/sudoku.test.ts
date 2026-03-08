import { describe, expect, it } from "vitest";
import {
  cellKey,
  generatePuzzle,
  getConflicts,
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
});

describe("solvePuzzle", () => {
  it("returns a valid 81-character solution", () => {
    const solution = solvePuzzle(KNOWN_PUZZLE);
    expect(solution).toHaveLength(81);
    expect(solution).toMatch(/^[1-9]{81}$/);
  });

  it("solution contains all digits 1-9 in each row", () => {
    const solution = solvePuzzle(KNOWN_PUZZLE);
    for (let row = 0; row < 9; row++) {
      const digits = solution.slice(row * 9, row * 9 + 9).split("");
      expect(new Set(digits).size).toBe(9);
    }
  });

  it("solution contains all digits 1-9 in each column", () => {
    const solution = solvePuzzle(KNOWN_PUZZLE);
    for (let col = 0; col < 9; col++) {
      const digits: string[] = [];
      for (let row = 0; row < 9; row++) {
        digits.push(solution[row * 9 + col]);
      }
      expect(new Set(digits).size).toBe(9);
    }
  });

  it("preserves given clues from the puzzle", () => {
    const solution = solvePuzzle(KNOWN_PUZZLE);
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
          expect(board[row][col].isGiven).toBe(true);
          expect(board[row][col].value).toBe(Number(char));
        } else {
          expect(board[row][col].isGiven).toBe(false);
          expect(board[row][col].value).toBeNull();
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
    board[0][0].value = 5;
    board[0][4].value = 5;
    const conflicts = getConflicts(board);
    expect(conflicts.has(cellKey(0, 0))).toBe(true);
    expect(conflicts.has(cellKey(0, 4))).toBe(true);
  });

  it("detects column conflict", () => {
    const board = makeEmptyBoard();
    board[0][0].value = 3;
    board[5][0].value = 3;
    const conflicts = getConflicts(board);
    expect(conflicts.has(cellKey(0, 0))).toBe(true);
    expect(conflicts.has(cellKey(5, 0))).toBe(true);
  });

  it("detects box conflict", () => {
    const board = makeEmptyBoard();
    board[0][0].value = 7;
    board[2][2].value = 7;
    const conflicts = getConflicts(board);
    expect(conflicts.has(cellKey(0, 0))).toBe(true);
    expect(conflicts.has(cellKey(2, 2))).toBe(true);
  });

  it("does not flag non-conflicting cells", () => {
    const board = makeEmptyBoard();
    board[0][0].value = 1;
    board[0][1].value = 2;
    board[1][0].value = 3;
    const conflicts = getConflicts(board);
    expect(conflicts.size).toBe(0);
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
        board[r][c].value = 1;
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
