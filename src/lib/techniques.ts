/**
 * Candidate-elimination techniques: the deductions between singles and
 * chains. Each scan finds its first application, applies it to the
 * state, and reports the full story — pattern cells, locked digits,
 * removed candidates — so the grader can rank it and the hint engine
 * can explain it. Scan order is part of the grading contract: changing
 * it changes which boards the generator accepts.
 */

import { boxIndex, popcount, UNITS } from "./board-geometry.ts";
import type { CandidateState } from "./candidates.ts";

export type EliminationKind =
  | "pointing"
  | "claiming"
  | "naked-pair"
  | "hidden-pair"
  | "naked-triple"
  | "hidden-triple"
  | "x-wing";

export type Elimination = {
  kind: EliminationKind;
  /** Digits the pattern locks (a single digit except for sets). */
  digits: number[];
  /** Cells forming the pattern — what a hint should highlight. */
  patternCells: number[];
  /** Candidates the pattern removes elsewhere. */
  removed: { cell: number; digit: number }[];
};

function eliminate(
  s: CandidateState,
  cell: number,
  bits: number,
  digitsOf: number[],
  removed: { cell: number; digit: number }[],
): boolean {
  const hit = s.cand[cell]! & bits;
  if (!hit) return false;
  s.cand[cell]! &= ~hit;
  for (const digit of digitsOf) {
    if (hit & (1 << digit)) removed.push({ cell, digit });
  }
  return true;
}

/** Pointing: a digit confined to one row/col of a box leaves that line. */
export function pointing(s: CandidateState): Elimination | null {
  for (let b = 0; b < 9; b++) {
    for (let v = 1; v <= 9; v++) {
      const bit = 1 << v;
      const cells = UNITS[18 + b]!.filter((c) => s.cand[c]! & bit);
      if (cells.length < 2) continue;
      const rows = new Set(cells.map((c) => Math.floor(c / 9)));
      const cols = new Set(cells.map((c) => c % 9));
      let line: number[] | null = null;
      if (rows.size === 1) line = UNITS[[...rows][0]!]!;
      else if (cols.size === 1) line = UNITS[9 + [...cols][0]!]!;
      if (!line) continue;
      const removed: { cell: number; digit: number }[] = [];
      let changed = false;
      for (const cell of line) {
        if (boxIndex(cell) !== b) {
          changed = eliminate(s, cell, bit, [v], removed) || changed;
        }
      }
      if (changed) {
        return { kind: "pointing", digits: [v], patternCells: cells, removed };
      }
    }
  }
  return null;
}

/** Claiming: a digit confined to one box of a row/col leaves that box. */
export function claiming(s: CandidateState): Elimination | null {
  for (let u = 0; u < 18; u++) {
    const unit = UNITS[u]!;
    for (let v = 1; v <= 9; v++) {
      const bit = 1 << v;
      const cells = unit.filter((c) => s.cand[c]! & bit);
      if (cells.length < 2) continue;
      const boxes = new Set(cells.map(boxIndex));
      if (boxes.size !== 1) continue;
      const removed: { cell: number; digit: number }[] = [];
      let changed = false;
      for (const cell of UNITS[18 + [...boxes][0]!]!) {
        if (!unit.includes(cell)) {
          changed = eliminate(s, cell, bit, [v], removed) || changed;
        }
      }
      if (changed) {
        return { kind: "claiming", digits: [v], patternCells: cells, removed };
      }
    }
  }
  return null;
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

function maskDigits(mask: number): number[] {
  const digits: number[] = [];
  for (let v = 1; v <= 9; v++) {
    if (mask & (1 << v)) digits.push(v);
  }
  return digits;
}

/** Naked set: `size` cells sharing the same `size` candidates own them. */
export function nakedSet(s: CandidateState, size: number): Elimination | null {
  for (const unit of UNITS) {
    const open = unit.filter((c) => s.grid[c] === 0);
    if (open.length <= size) continue;
    const narrow = open.filter((c) => popcount(s.cand[c]!) <= size);
    for (const combo of kCombinations(narrow, size)) {
      let union = 0;
      for (const c of combo) union |= s.cand[c]!;
      if (popcount(union) !== size) continue;
      const digits = maskDigits(union);
      const removed: { cell: number; digit: number }[] = [];
      let changed = false;
      for (const c of open) {
        if (!combo.includes(c)) {
          changed = eliminate(s, c, union, digits, removed) || changed;
        }
      }
      if (changed) {
        return {
          kind: size === 2 ? "naked-pair" : "naked-triple",
          digits,
          patternCells: combo,
          removed,
        };
      }
    }
  }
  return null;
}

/** Hidden set: `size` digits confined to the same `size` cells own them. */
export function hiddenSet(s: CandidateState, size: number): Elimination | null {
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
      const removed: { cell: number; digit: number }[] = [];
      let changed = false;
      for (const c of holders) {
        const others = s.cand[c]! & ~mask;
        changed =
          eliminate(s, c, others, maskDigits(others), removed) || changed;
      }
      if (changed) {
        return {
          kind: size === 2 ? "hidden-pair" : "hidden-triple",
          digits: combo,
          patternCells: holders,
          removed,
        };
      }
    }
  }
  return null;
}

/**
 * X-wing: a digit held to the same two lines in two crossing lines
 * forms a rectangle; the digit leaves the rest of the crossing lines.
 * `cellAt` maps (line, cross) to a cell so one scan covers both the
 * row-based and the column-based orientation.
 */
function xWingOriented(
  s: CandidateState,
  v: number,
  cellAt: (line: number, cross: number) => number,
): Elimination | null {
  const bit = 1 << v;
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
      const removed: { cell: number; digit: number }[] = [];
      let changed = false;
      for (let line = 0; line < 9; line++) {
        if (line === a || line === b) continue;
        for (const cross of crosses[a]!) {
          changed =
            eliminate(s, cellAt(line, cross), bit, [v], removed) || changed;
        }
      }
      if (changed) {
        return {
          kind: "x-wing",
          digits: [v],
          patternCells: [a, b].flatMap((line) =>
            crosses[a]!.map((cross) => cellAt(line, cross)),
          ),
          removed,
        };
      }
    }
  }
  return null;
}

export function xWing(s: CandidateState): Elimination | null {
  for (let v = 1; v <= 9; v++) {
    const rows = xWingOriented(s, v, (row, col) => row * 9 + col);
    if (rows) return rows;
    const cols = xWingOriented(s, v, (col, row) => row * 9 + col);
    if (cols) return cols;
  }
  return null;
}
