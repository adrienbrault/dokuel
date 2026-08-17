/**
 * Human-technique sudoku grader. Solves with the deductions a player can
 * actually execute and reports the hardest tier the puzzle demanded.
 * Pure functions, no dependencies; same 81-char board format as solver.
 *
 * Tiers:
 *   1 — naked/hidden singles
 *   2 — locked candidates, naked/hidden pairs
 *   3 — naked/hidden triples, X-wing
 *   4 — none of the above suffice: chains or trial-and-error required
 */

import { boxIndex, popcount, UNITS } from "./board-geometry.ts";
import {
  type CandidateState,
  findSingle,
  initCandidates,
  place,
} from "./candidates.ts";

export type TechniqueTier = 1 | 2 | 3 | 4;

export type PuzzleGrade = {
  tier: TechniqueTier;
  /**
   * Empty cells left when tier ≤3 techniques exhaust — 0 when they solve
   * the puzzle, larger when more of the board resists everything short
   * of chains or guessing.
   */
  stuckCells: number;
};

type GradeState = CandidateState;

function eliminate(s: GradeState, cell: number, bits: number): boolean {
  if (!(s.cand[cell]! & bits)) return false;
  s.cand[cell]! &= ~bits;
  return true;
}

/** Pointing: a digit confined to one row/col of a box leaves that line. */
function pointingCandidates(s: GradeState): boolean {
  for (let b = 0; b < 9; b++) {
    for (let v = 1; v <= 9; v++) {
      const bit = 1 << v;
      const cells = UNITS[18 + b]!.filter((c) => s.cand[c]! & bit);
      if (cells.length < 2) continue;
      const rows = new Set(cells.map((c) => Math.floor(c / 9)));
      const cols = new Set(cells.map((c) => c % 9));
      let changed = false;
      if (rows.size === 1) {
        for (const cell of UNITS[[...rows][0]!]!) {
          if (boxIndex(cell) !== b)
            changed = eliminate(s, cell, bit) || changed;
        }
      } else if (cols.size === 1) {
        for (const cell of UNITS[9 + [...cols][0]!]!) {
          if (boxIndex(cell) !== b)
            changed = eliminate(s, cell, bit) || changed;
        }
      }
      if (changed) return true;
    }
  }
  return false;
}

/** Claiming: a digit confined to one box of a row/col leaves that box. */
function claimingCandidates(s: GradeState): boolean {
  for (let u = 0; u < 18; u++) {
    const unit = UNITS[u]!;
    for (let v = 1; v <= 9; v++) {
      const bit = 1 << v;
      const cells = unit.filter((c) => s.cand[c]! & bit);
      if (cells.length < 2) continue;
      const boxes = new Set(cells.map(boxIndex));
      if (boxes.size !== 1) continue;
      let changed = false;
      for (const cell of UNITS[18 + [...boxes][0]!]!) {
        if (!unit.includes(cell)) changed = eliminate(s, cell, bit) || changed;
      }
      if (changed) return true;
    }
  }
  return false;
}

function kCombinations<T>(items: T[], k: number): T[][] {
  const out: T[][] = [];
  const combo: T[] = [];
  const rec = (start: number): void => {
    if (combo.length === k) {
      out.push([...combo]);
      return;
    }
    for (let i = start; i <= items.length - (k - combo.length); i++) {
      combo.push(items[i]!);
      rec(i + 1);
      combo.pop();
    }
  };
  rec(0);
  return out;
}

/** Naked set: `size` cells sharing the same `size` candidates own them. */
function nakedSet(s: GradeState, size: number): boolean {
  for (const unit of UNITS) {
    const open = unit.filter((c) => s.grid[c] === 0);
    if (open.length <= size) continue;
    const narrow = open.filter((c) => popcount(s.cand[c]!) <= size);
    for (const combo of kCombinations(narrow, size)) {
      let union = 0;
      for (const c of combo) union |= s.cand[c]!;
      if (popcount(union) !== size) continue;
      let changed = false;
      for (const c of open) {
        if (!combo.includes(c)) changed = eliminate(s, c, union) || changed;
      }
      if (changed) return true;
    }
  }
  return false;
}

/** Hidden set: `size` digits confined to the same `size` cells own them. */
function hiddenSet(s: GradeState, size: number): boolean {
  for (const unit of UNITS) {
    const open = unit.filter((c) => s.grid[c] === 0);
    if (open.length <= size) continue;
    const digits: number[] = [];
    for (let v = 1; v <= 9; v++) {
      if (open.some((c) => s.cand[c]! & (1 << v))) digits.push(v);
    }
    if (digits.length <= size) continue;
    for (const combo of kCombinations(digits, size)) {
      let mask = 0;
      for (const v of combo) mask |= 1 << v;
      const holders = open.filter((c) => s.cand[c]! & mask);
      if (holders.length !== size) continue;
      let changed = false;
      for (const c of holders) {
        changed = eliminate(s, c, s.cand[c]! & ~mask) || changed;
      }
      if (changed) return true;
    }
  }
  return false;
}

/**
 * X-wing: a digit held to the same two lines in two crossing lines
 * forms a rectangle; the digit leaves the rest of the crossing lines.
 * `lineOf`/`crossOf` map (line, position) to a cell so one scan covers
 * both the row-based and the column-based orientation.
 */
function xWingOriented(
  s: GradeState,
  bit: number,
  cellAt: (line: number, cross: number) => number,
): boolean {
  const crosses: number[][] = [];
  for (let line = 0; line < 9; line++) {
    const held: number[] = [];
    for (let cross = 0; cross < 9; cross++) {
      if (s.cand[cellAt(line, cross)]! & bit) held.push(cross);
    }
    crosses.push(held);
  }
  for (let a = 0; a < 9; a++) {
    if (crosses[a]!.length !== 2) continue;
    for (let b = a + 1; b < 9; b++) {
      if (crosses[b]!.length !== 2) continue;
      if (
        crosses[a]![0] !== crosses[b]![0] ||
        crosses[a]![1] !== crosses[b]![1]
      ) {
        continue;
      }
      let changed = false;
      for (let line = 0; line < 9; line++) {
        if (line === a || line === b) continue;
        for (const cross of crosses[a]!) {
          changed = eliminate(s, cellAt(line, cross), bit) || changed;
        }
      }
      if (changed) return true;
    }
  }
  return false;
}

function xWing(s: GradeState): boolean {
  for (let v = 1; v <= 9; v++) {
    const bit = 1 << v;
    if (xWingOriented(s, bit, (row, col) => row * 9 + col)) return true;
    if (xWingOriented(s, bit, (col, row) => row * 9 + col)) return true;
  }
  return false;
}

/**
 * Grade a puzzle by the hardest technique required to finish it. A
 * malformed or internally contradictory puzzle grades as maximally
 * stuck — nothing a human technique could do with it.
 */
export function gradePuzzle(puzzle: string): PuzzleGrade {
  const s = initCandidates(puzzle);
  if (!s) return { tier: 4, stuckCells: 81 };
  let tier: TechniqueTier = 1;
  while (s.empty > 0) {
    const single = findSingle(s);
    if (single) {
      place(s, single.cell, single.digit);
      continue;
    }
    if (
      pointingCandidates(s) ||
      claimingCandidates(s) ||
      nakedSet(s, 2) ||
      hiddenSet(s, 2)
    ) {
      tier = tier < 2 ? 2 : tier;
      continue;
    }
    if (nakedSet(s, 3) || hiddenSet(s, 3) || xWing(s)) {
      tier = tier < 3 ? 3 : tier;
      continue;
    }
    return { tier: 4, stuckCells: s.empty };
  }
  return { tier, stuckCells: 0 };
}
