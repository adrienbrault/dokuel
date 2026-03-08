import * as sudokuLib from "sudoku";
import type { Board, Cell, Difficulty } from "./types.ts";

const DIFFICULTY_CLUES: Record<Difficulty, { min: number; max: number }> = {
  easy: { min: 40, max: 50 },
  medium: { min: 32, max: 39 },
  hard: { min: 26, max: 31 },
  expert: { min: 20, max: 25 },
};

export function generatePuzzle(difficulty: Difficulty): string {
  const { min, max } = DIFFICULTY_CLUES[difficulty];
  const targetClues = min + Math.floor(Math.random() * (max - min + 1));

  const raw = sudokuLib.makepuzzle() as (number | null)[];
  const solution = sudokuLib.solvepuzzle(raw) as number[];

  const givenIndices: number[] = [];
  const emptyIndices: number[] = [];
  for (let i = 0; i < 81; i++) {
    if (raw[i] !== null) {
      givenIndices.push(i);
    } else {
      emptyIndices.push(i);
    }
  }

  // Remove clues if we have too many
  while (givenIndices.length > targetClues) {
    const removeIdx = Math.floor(Math.random() * givenIndices.length);
    const cellIdx = givenIndices[removeIdx]!;
    raw[cellIdx] = null;
    givenIndices.splice(removeIdx, 1);
  }

  // Add clues from solution if we have too few
  while (givenIndices.length < targetClues && emptyIndices.length > 0) {
    const addIdx = Math.floor(Math.random() * emptyIndices.length);
    const cellIdx = emptyIndices[addIdx]!;
    raw[cellIdx] = solution[cellIdx]!;
    givenIndices.push(cellIdx);
    emptyIndices.splice(addIdx, 1);
  }

  return raw.map((v) => (v === null ? "." : String(v + 1))).join("");
}

export function solvePuzzle(puzzle: string): string {
  const raw = puzzle.split("").map((c) => (c === "." ? null : Number(c) - 1));
  const solution = sudokuLib.solvepuzzle(raw) as number[];
  return solution.map((v) => String(v + 1)).join("");
}

export function parsePuzzle(puzzle: string): Board {
  const board: Board = [];
  for (let row = 0; row < 9; row++) {
    const cells: Cell[] = [];
    for (let col = 0; col < 9; col++) {
      const char = puzzle[row * 9 + col];
      const isEmpty = char === ".";
      cells.push({
        value: isEmpty ? null : Number(char),
        isGiven: !isEmpty,
        notes: new Set<number>(),
      });
    }
    board.push(cells);
  }
  return board;
}

/** Encode row,col as a single number for use as Set key. */
export function cellKey(row: number, col: number): number {
  return row * 9 + col;
}

/**
 * Get all conflicting cell positions as a Set of numeric keys (row*9+col).
 * A conflict = same non-null value in the same row, column, or 3x3 box.
 */
export function getConflicts(board: Board): Set<number> {
  const conflicts = new Set<number>();

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const value = board[row]![col]!.value;
      if (value === null) continue;

      const key = cellKey(row, col);

      for (let c = 0; c < 9; c++) {
        if (c !== col && board[row]![c]!.value === value) {
          conflicts.add(key);
          conflicts.add(cellKey(row, c));
        }
      }

      for (let r = 0; r < 9; r++) {
        if (r !== row && board[r]![col]!.value === value) {
          conflicts.add(key);
          conflicts.add(cellKey(r, col));
        }
      }

      const boxRow = Math.floor(row / 3) * 3;
      const boxCol = Math.floor(col / 3) * 3;
      for (let r = boxRow; r < boxRow + 3; r++) {
        for (let c = boxCol; c < boxCol + 3; c++) {
          if ((r !== row || c !== col) && board[r]![c]!.value === value) {
            conflicts.add(key);
            conflicts.add(cellKey(r, c));
          }
        }
      }
    }
  }

  return conflicts;
}

/**
 * Get all cells whose user-entered value differs from the solution.
 * Only checks non-given cells that have a value. Returns a Set of
 * numeric keys (row*9+col), same format as getConflicts.
 */
export function getErrors(board: Board, solution: string): Set<number> {
  const errors = new Set<number>();
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const cell = board[row]![col]!;
      if (cell.isGiven || cell.value === null) continue;
      const solutionValue = Number(solution[row * 9 + col]);
      if (cell.value !== solutionValue) {
        errors.add(cellKey(row, col));
      }
    }
  }
  return errors;
}

/**
 * Check if board is complete: all cells filled and no conflicts.
 * Accepts pre-computed conflicts to avoid redundant recomputation.
 */
export function isBoardComplete(
  board: Board,
  conflicts?: Set<number>,
): boolean {
  for (const row of board) {
    for (const cell of row) {
      if (cell.value === null) return false;
    }
  }
  return (conflicts ?? getConflicts(board)).size === 0;
}
