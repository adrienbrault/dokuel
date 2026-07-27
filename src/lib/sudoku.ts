import * as sudokuLib from "sudoku";
import type { Board, Cell, Difficulty } from "./types.ts";

/**
 * Clue counts per difficulty.
 *
 * The floor is set by the generator, not by taste: `makepuzzle()`
 * returns a *minimal* puzzle — one where removing any single clue
 * admits a second solution — and those land at roughly 22–28 clues.
 * So ~22 is the sparsest uniquely-solvable puzzle available, and
 * Expert sits there. Easier tiers are reached by adding clues back.
 */
export const DIFFICULTY_CLUES: Record<
  Difficulty,
  { min: number; max: number }
> = {
  easy: { min: 38, max: 45 },
  medium: { min: 30, max: 35 },
  hard: { min: 26, max: 29 },
  expert: { min: 22, max: 25 },
};

// How many minimal puzzles to draw looking for one already inside the
// target band. Only Expert can miss: every other band tops out at or
// above the ~28 clues makepuzzle() produces at its densest, so their
// first draw always fits. Bounded so generation stays fast even in the
// unlucky tail — an over-band draw is still uniquely solvable, just
// slightly easier than asked for.
const MAX_DRAWS = 8;

function countClues(raw: (number | null)[]): number {
  return raw.reduce<number>((n, v) => (v === null ? n : n + 1), 0);
}

/**
 * Generate a uniquely-solvable puzzle for the given difficulty.
 *
 * Clues are only ever *added*, never removed. Removing a clue from a
 * minimal puzzle admits a second solution, which breaks deduction and
 * makes answer-key comparison meaningless — the solver would pick one
 * of several valid grids, turning a player's correct digit red. Adding
 * a clue that agrees with the solution can only rule solutions out, so
 * the single solution always survives.
 */
export function generatePuzzle(difficulty: Difficulty): string {
  const { min, max } = DIFFICULTY_CLUES[difficulty];

  // Draw minimal puzzles until one is at or below the top of the band.
  // Stopping at `max` rather than at the exact target matters: the
  // sparsest targets are the rarest draws, so waiting for an exact
  // match would burn every draw on most Expert games. Keep the sparsest
  // candidate seen in case none lands in band.
  let raw = sudokuLib.makepuzzle() as (number | null)[];
  for (let draw = 1; draw < MAX_DRAWS && countClues(raw) > max; draw++) {
    const candidate = sudokuLib.makepuzzle() as (number | null)[];
    if (countClues(candidate) < countClues(raw)) raw = candidate;
  }

  const solution = sudokuLib.solvepuzzle(raw) as number[];
  const emptyIndices: number[] = [];
  for (let i = 0; i < 81; i++) {
    if (raw[i] === null) emptyIndices.push(i);
  }

  // Pad up to a random point in the band. A draw already at or above
  // the target keeps its own clue count — thinning it would break
  // uniqueness, and it is in band already.
  const targetClues = min + Math.floor(Math.random() * (max - min + 1));
  let clues = 81 - emptyIndices.length;
  while (clues < targetClues && emptyIndices.length > 0) {
    const pick = Math.floor(Math.random() * emptyIndices.length);
    const cellIdx = emptyIndices[pick]!;
    raw[cellIdx] = solution[cellIdx]!;
    emptyIndices.splice(pick, 1);
    clues++;
  }

  return raw.map((v) => (v === null ? "." : String(v + 1))).join("");
}

/**
 * Count how many ways a puzzle can be completed, stopping once `cap`
 * solutions have been found. The cap matters: a sparse grid can have
 * astronomically many completions, and callers only ever need to know
 * "exactly one" versus "more than one".
 *
 * This is the uniqueness oracle the generator is built on. A puzzle
 * with more than one solution is unsolvable by deduction and makes
 * answer-key comparison meaningless — a player's valid digit would
 * read as an error simply because the solver picked the other one.
 */
export function countSolutions(puzzle: string, cap = 2): number {
  const grid = puzzle.split("").map((c) => (c === "." ? 0 : Number(c)));
  let count = 0;

  // Clues that already conflict admit no completion. Detecting that up
  // front matters for more than correctness: the backtracker would
  // otherwise explore the whole space before concluding the same thing,
  // which on a near-empty contradictory grid does not terminate in any
  // useful time.
  for (let index = 0; index < 81; index++) {
    const value = grid[index]!;
    if (value === 0) continue;
    grid[index] = 0;
    const legal = isLegalPlacement(grid, index, value);
    grid[index] = value;
    if (!legal) return 0;
  }

  const search = (from: number): void => {
    if (count >= cap) return;
    let index = from;
    while (index < 81 && grid[index] !== 0) index++;
    if (index === 81) {
      count++;
      return;
    }
    for (let value = 1; value <= 9; value++) {
      if (!isLegalPlacement(grid, index, value)) continue;
      grid[index] = value;
      search(index + 1);
      grid[index] = 0;
      if (count >= cap) return;
    }
  };

  search(0);
  return count;
}

/** True when `value` may occupy `index` given the digits already in the grid. */
function isLegalPlacement(
  grid: number[],
  index: number,
  value: number,
): boolean {
  const row = Math.floor(index / 9);
  const col = index % 9;
  for (let k = 0; k < 9; k++) {
    if (grid[row * 9 + k] === value) return false;
    if (grid[k * 9 + col] === value) return false;
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (grid[r * 9 + c] === value) return false;
    }
  }
  return true;
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
