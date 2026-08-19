/**
 * Unit-local candidate-elimination techniques. Each scan finds its
 * first application, applies it to the state, and reports the full
 * story — pattern cells, locked digits, removed candidates — so the
 * grader can rank it and the hint engine can explain it. Wing- and
 * fish-family scans live in wings.ts; the order the scans are tried
 * in, and what each one is worth, live in ladder.ts.
 */

import {
  boxIndex,
  kCombinations,
  maskDigits,
  popcount,
  UNITS,
} from "./board-geometry.ts";
import {
  type CandidateState,
  type Elimination,
  type EliminationKind,
  eliminate,
} from "./candidates.ts";

const NAKED_KINDS: Record<number, EliminationKind> = {
  2: "naked-pair",
  3: "naked-triple",
  4: "naked-quad",
};
const HIDDEN_KINDS: Record<number, EliminationKind> = {
  2: "hidden-pair",
  3: "hidden-triple",
  4: "hidden-quad",
};

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
          kind: NAKED_KINDS[size]!,
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
          kind: HIDDEN_KINDS[size]!,
          digits: combo,
          patternCells: holders,
          removed,
        };
      }
    }
  }
  return null;
}
