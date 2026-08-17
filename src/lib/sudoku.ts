import { gradePuzzle, type PuzzleGrade } from "./grader.ts";
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

// Clue count is a weak difficulty signal — half the boards dug into the
// hard band fall to naked/hidden singles. Hard and expert therefore
// re-dig until the technique grader signs off. A dig+grade attempt runs
// in single-digit milliseconds and each bar accepts roughly a fifth of
// attempts, so the loop converges almost always; the rare exhaustion
// returns the hardest board seen instead of blocking the UI.
const GRADE_ATTEMPTS = 32;
// Hard must need triples/X-wing at minimum, but a tier-4 board may
// leave at most this many cells unresolved — deeper is expert country.
const HARD_MAX_STUCK = 35;
// Expert must defeat every graded technique with at least this many
// cells still open — chains or trial-and-error for most of the board.
const EXPERT_MIN_STUCK = 40;
// Random minimal digs land 20-28 clues; a sparser cap keeps the pinned
// expert clue band honest even when the grade bar is met late.
const EXPERT_MAX_CLUES = 28;

function meetsHardBar(grade: PuzzleGrade): boolean {
  return grade.tier >= 3 && grade.stuckCells <= HARD_MAX_STUCK;
}

function meetsExpertBar(grade: PuzzleGrade): boolean {
  return grade.tier === 4 && grade.stuckCells >= EXPERT_MIN_STUCK;
}

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
    // Minimal puzzles (every remaining clue necessary), re-dug until
    // the grade bar confirms the board resists every technique deeply.
    let best: { puzzle: string; solution: string } | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let attempt = 0; attempt < GRADE_ATTEMPTS; attempt++) {
      const solution = generateSolvedGrid(rng);
      const puzzle = digPuzzle(solution, 17, rng);
      const grade = gradePuzzle(puzzle);
      if (meetsExpertBar(grade) && countClues(puzzle) <= EXPERT_MAX_CLUES) {
        return { puzzle, solution };
      }
      // Fallback ranking: the higher tier, then the deeper stuck.
      const score = grade.tier * 100 + grade.stuckCells;
      if (score > bestScore) {
        best = { puzzle, solution };
        bestScore = score;
      }
    }
    return best!;
  }

  if (difficulty === "hard") {
    const { min, max } = DIFFICULTY_CLUES.hard;
    let best: { puzzle: string; solution: string } | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let attempt = 0; attempt < GRADE_ATTEMPTS; attempt++) {
      const solution = generateSolvedGrid(rng);
      const target = min + Math.floor(rng() * (max - min + 1));
      const puzzle = digPuzzle(solution, target, rng);
      const grade = gradePuzzle(puzzle);
      if (meetsHardBar(grade) && countClues(puzzle) <= max) {
        return { puzzle, solution };
      }
      // Fallback ranking errs toward too hard rather than too easy:
      // higher tier first, then the shallower stuck depth.
      const score = grade.tier * 100 - grade.stuckCells;
      if (score > bestScore) {
        best = { puzzle, solution };
        bestScore = score;
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
