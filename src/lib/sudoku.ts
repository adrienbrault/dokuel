import { digPuzzle, generateSolvedGrid, type Rng, solve } from "./solver.ts";
import type { Board, Cell, Difficulty } from "./types.ts";

// Bands reflect what uniqueness-preserving digging can actually reach:
// random digging exhausts at roughly 22-28 clues, so expert digs to a
// minimal puzzle (every remaining clue is necessary) instead of chasing
// a fixed count near the theoretical 17-clue floor.
const DIFFICULTY_CLUES: Record<
  Exclude<Difficulty, "expert">,
  { min: number; max: number }
> = {
  easy: { min: 36, max: 45 },
  medium: { min: 28, max: 35 },
  hard: { min: 24, max: 27 },
};

const MAX_ATTEMPTS = 4;
const EXPERT_ATTEMPTS = 3;

function countClues(puzzle: string): number {
  let clues = 0;
  for (let i = 0; i < 81; i++) {
    if (puzzle[i] !== ".") clues++;
  }
  return clues;
}

/**
 * Generate a puzzle together with the solved grid it was dug from.
 * Every puzzle has exactly one solution by construction — digPuzzle
 * re-verifies uniqueness after each clue removal — so the returned
 * solution is THE solution, safe for error-highlighting and hints.
 */
export function generatePuzzleWithSolution(
  difficulty: Difficulty,
  rng: Rng = Math.random,
): { puzzle: string; solution: string } {
  if (difficulty === "expert") {
    // Minimal puzzles: dig each grid to exhaustion, keep the sparsest.
    let best: { puzzle: string; solution: string } | null = null;
    let bestClues = 82;
    for (let attempt = 0; attempt < EXPERT_ATTEMPTS; attempt++) {
      const solution = generateSolvedGrid(rng);
      const puzzle = digPuzzle(solution, 17, rng);
      const clues = countClues(puzzle);
      if (clues < bestClues) {
        best = { puzzle, solution };
        bestClues = clues;
      }
    }
    return best!;
  }

  const { min, max } = DIFFICULTY_CLUES[difficulty];
  const target = min + Math.floor(rng() * (max - min + 1));
  let best: { puzzle: string; solution: string } | null = null;
  let bestClues = 82;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const solution = generateSolvedGrid(rng);
    const puzzle = digPuzzle(solution, target, rng);
    const clues = countClues(puzzle);
    if (clues < bestClues) {
      best = { puzzle, solution };
      bestClues = clues;
    }
    // Digging stops exactly at the target unless it exhausted above it.
    if (clues <= target) break;
  }
  return best!;
}

export function generatePuzzle(
  difficulty: Difficulty,
  rng: Rng = Math.random,
): string {
  return generatePuzzleWithSolution(difficulty, rng).puzzle;
}

/**
 * Solve an arbitrary puzzle string. Returns null when the input is
 * malformed or unsolvable — callers treat that as a corrupt save or
 * corrupt room state, never as a crash.
 */
export function solvePuzzle(puzzle: string): string | null {
  return solve(puzzle);
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
