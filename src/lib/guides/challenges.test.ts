import { describe, expect, it } from "vitest";
import { cellKey, parsePuzzle } from "../sudoku.ts";
import { candidatesAt } from "../sudoku-candidates.ts";
import { GUIDES } from "./index.ts";
import type { Challenge, TechniqueId } from "./types.ts";

/**
 * Compute the candidate set visible to the player for a given cell,
 * honoring restricts (via challenge.initialCandidates) on top of
 * what the puzzle's givens would naturally allow.
 */
function visibleCandidates(challenge: Challenge): Map<number, Set<number>> {
  const board = parsePuzzle(challenge.puzzle);
  const result = new Map<number, Set<number>>();
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const cell = board[row]![col]!;
      if (cell.value !== null) continue;
      const key = cellKey(row, col);
      const restrict = challenge.initialCandidates.get(key);
      const auto = candidatesAt(board, row, col);
      // initialCandidates already merges restrict with auto in the builder.
      result.set(key, restrict ?? auto);
    }
  }
  return result;
}

function cellsInRow(row: number): number[] {
  return Array.from({ length: 9 }, (_, c) => cellKey(row, c));
}
function cellsInCol(col: number): number[] {
  return Array.from({ length: 9 }, (_, r) => cellKey(r, col));
}
function cellsInBox(box: number): number[] {
  const boxRow = Math.floor(box / 3) * 3;
  const boxCol = (box % 3) * 3;
  const result: number[] = [];
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      result.push(cellKey(r, c));
    }
  }
  return result;
}
function boxOf(row: number, col: number): number {
  return Math.floor(row / 3) * 3 + Math.floor(col / 3);
}

/**
 * Return the cells in each of the three units a cell belongs to, so a
 * technique check can detect which unit the pattern lives in.
 */
function unitsContaining(row: number, col: number): number[][] {
  return [cellsInRow(row), cellsInCol(col), cellsInBox(boxOf(row, col))];
}

function cellsWithDigit(
  candidates: Map<number, Set<number>>,
  cells: number[],
  digit: number,
): number[] {
  return cells.filter((k) => candidates.get(k)?.has(digit));
}

function digitsInCells(
  candidates: Map<number, Set<number>>,
  cells: number[],
): Set<number> {
  const result = new Set<number>();
  for (const k of cells) {
    const set = candidates.get(k);
    if (set) for (const d of set) result.add(d);
  }
  return result;
}

type Validator = (
  c: Challenge,
  cands: Map<number, Set<number>>,
) => string | null;

/**
 * Per-technique invariant: returns null on success or an error message.
 * Each validator confirms the challenge's stated answer is consistent
 * with what the technique would actually deduce from visible candidates.
 */
const VALIDATORS: Record<TechniqueId, Validator> = {
  scanning: (c, cands) => validateBoxHiddenSingle(c, cands),
  "naked-singles": (c, cands) => validateNakedSingle(c, cands),
  "hidden-singles": (c, cands) => validateUnitHiddenSingle(c, cands),
  "naked-pairs": (c, cands) => validateNakedSet(c, cands, 2),
  "naked-triples": (c, cands) => validateNakedSet(c, cands, 3),
  "hidden-pairs": (c, cands) => validateHiddenSet(c, cands, 2),
  "hidden-triples": (c, cands) => validateHiddenSet(c, cands, 3),
  "pointing-pairs": (c, cands) => validatePointing(c, cands),
  claiming: (c, cands) => validateClaiming(c, cands),
  "x-wing": (c, cands) => validateFish(c, cands, 2),
  swordfish: (c, cands) => validateFish(c, cands, 3),
  jellyfish: (c, cands) => validateFish(c, cands, 4),
  "y-wing": (c, cands) => validateYWing(c, cands),
};

// ─── Validators ───────────────────────────────────────────────────────

function validateNakedSingle(
  c: Challenge,
  cands: Map<number, Set<number>>,
): string | null {
  if (c.question.kind !== "place") return "expected place";
  const key = cellKey(c.question.cell.row, c.question.cell.col);
  const set = cands.get(key);
  if (!set) return `target ${key} has no candidates (is it a given?)`;
  if (set.size !== 1)
    return `target should have exactly 1 candidate, has ${set.size}: {${[...set].join(",")}}`;
  if (!set.has(c.question.value))
    return `expected value ${c.question.value} not in candidates {${[...set].join(",")}}`;
  return null;
}

function validateUnitHiddenSingle(
  c: Challenge,
  cands: Map<number, Set<number>>,
): string | null {
  if (c.question.kind !== "select-cells") return "expected select-cells";
  if (c.question.cells.length !== 1)
    return `hidden single expects 1 cell, got ${c.question.cells.length}`;
  const { row, col } = c.question.cells[0]!;
  const key = cellKey(row, col);
  const targetCands = cands.get(key);
  if (!targetCands) return `target ${key} has no candidates`;
  // The hidden single digit must appear in the target and in exactly one
  // unit (row/col/box) of the cell as the only candidate slot.
  for (const digit of targetCands) {
    for (const unit of unitsContaining(row, col)) {
      const cellsWith = cellsWithDigit(cands, unit, digit);
      if (cellsWith.length === 1 && cellsWith[0] === key) return null;
    }
  }
  return `target cell is not a hidden single for any digit in any of its three units`;
}

function validateBoxHiddenSingle(
  c: Challenge,
  cands: Map<number, Set<number>>,
): string | null {
  if (c.question.kind !== "select-cells") return "expected select-cells";
  if (c.question.cells.length !== 1)
    return `scanning expects 1 cell, got ${c.question.cells.length}`;
  const { row, col } = c.question.cells[0]!;
  const key = cellKey(row, col);
  const targetCands = cands.get(key);
  if (!targetCands) return `target ${key} has no candidates`;
  const box = cellsInBox(boxOf(row, col));
  for (const digit of targetCands) {
    const cellsWith = cellsWithDigit(cands, box, digit);
    if (cellsWith.length === 1 && cellsWith[0] === key) return null;
  }
  return `target cell is not a scanning hidden single in its box`;
}

function validateNakedSet(
  c: Challenge,
  cands: Map<number, Set<number>>,
  n: number,
): string | null {
  if (c.question.kind !== "select-cells") return "expected select-cells";
  if (c.question.cells.length !== n)
    return `naked set expects ${n} cells, got ${c.question.cells.length}`;
  const keys = c.question.cells.map((p) => cellKey(p.row, p.col));
  // Combined candidates must be exactly n digits.
  const combined = digitsInCells(cands, keys);
  if (combined.size !== n)
    return `combined candidates should be ${n} digits, got ${combined.size}: {${[...combined].join(",")}}`;
  // All n cells must share a single unit.
  const rowSet = new Set(c.question.cells.map((p) => p.row));
  const colSet = new Set(c.question.cells.map((p) => p.col));
  const boxSet = new Set(c.question.cells.map((p) => boxOf(p.row, p.col)));
  if (rowSet.size !== 1 && colSet.size !== 1 && boxSet.size !== 1) {
    return `naked set cells must share a unit (row/col/box)`;
  }
  return null;
}

function validateHiddenSet(
  c: Challenge,
  cands: Map<number, Set<number>>,
  n: number,
): string | null {
  if (c.question.kind !== "select-cells") return "expected select-cells";
  if (c.question.cells.length !== n)
    return `hidden set expects ${n} cells, got ${c.question.cells.length}`;
  const keys = c.question.cells.map((p) => cellKey(p.row, p.col));
  const keySet = new Set(keys);
  // Find a unit containing all n cells, then n digits within that unit
  // that ONLY appear in these n cells.
  const candidateUnits: number[][] = [];
  const rowSet = new Set(c.question.cells.map((p) => p.row));
  const colSet = new Set(c.question.cells.map((p) => p.col));
  const boxSet = new Set(c.question.cells.map((p) => boxOf(p.row, p.col)));
  if (rowSet.size === 1) candidateUnits.push(cellsInRow([...rowSet][0]!));
  if (colSet.size === 1) candidateUnits.push(cellsInCol([...colSet][0]!));
  if (boxSet.size === 1) candidateUnits.push(cellsInBox([...boxSet][0]!));
  if (candidateUnits.length === 0) return `cells don't share a single unit`;
  for (const unit of candidateUnits) {
    const hiddenDigits: number[] = [];
    for (let d = 1; d <= 9; d++) {
      const cellsWith = cellsWithDigit(cands, unit, d);
      if (cellsWith.length === 0) continue;
      if (cellsWith.every((k) => keySet.has(k))) hiddenDigits.push(d);
    }
    if (hiddenDigits.length === n) return null;
  }
  return `no unit shared by the cells contains exactly ${n} hidden digits`;
}

function validatePointing(
  c: Challenge,
  cands: Map<number, Set<number>>,
): string | null {
  if (c.question.kind !== "eliminate") return "expected eliminate";
  if (c.question.digits.length !== 1)
    return `pointing expects 1 digit, got ${c.question.digits.length}`;
  const digit = c.question.digits[0]!;
  const target = c.question.cell;
  const tKey = cellKey(target.row, target.col);
  // Target must currently have the digit as a candidate.
  if (!cands.get(tKey)?.has(digit))
    return `target ${tKey} doesn't carry digit ${digit}`;
  // Find a box whose candidate cells for `digit` all share the target's
  // row or column, AND the target is NOT in that box.
  for (let box = 0; box < 9; box++) {
    const boxCells = cellsInBox(box);
    if (boxCells.includes(tKey)) continue;
    const candidateCells = cellsWithDigit(cands, boxCells, digit);
    if (candidateCells.length < 1) continue;
    const rows = new Set(candidateCells.map((k) => Math.floor(k / 9)));
    const cols = new Set(candidateCells.map((k) => k % 9));
    if (rows.size === 1 && [...rows][0] === target.row) return null;
    if (cols.size === 1 && [...cols][0] === target.col) return null;
  }
  return `no pointing pair in a peer box justifies eliminating ${digit} from target`;
}

function validateClaiming(
  c: Challenge,
  cands: Map<number, Set<number>>,
): string | null {
  if (c.question.kind !== "eliminate") return "expected eliminate";
  if (c.question.digits.length !== 1)
    return `claiming expects 1 digit, got ${c.question.digits.length}`;
  const digit = c.question.digits[0]!;
  const target = c.question.cell;
  const tKey = cellKey(target.row, target.col);
  if (!cands.get(tKey)?.has(digit))
    return `target ${tKey} doesn't carry digit ${digit}`;
  const targetBox = boxOf(target.row, target.col);
  // Find a row OR column where all candidates for `digit` sit inside the
  // target's box, and the target is NOT on that line.
  for (let r = 0; r < 9; r++) {
    if (r === target.row) continue;
    const rowCells = cellsInRow(r);
    const candidateCells = cellsWithDigit(cands, rowCells, digit);
    if (candidateCells.length < 1) continue;
    const boxes = new Set(
      candidateCells.map((k) => boxOf(Math.floor(k / 9), k % 9)),
    );
    if (boxes.size === 1 && [...boxes][0] === targetBox) return null;
  }
  for (let col = 0; col < 9; col++) {
    if (col === target.col) continue;
    const colCells = cellsInCol(col);
    const candidateCells = cellsWithDigit(cands, colCells, digit);
    if (candidateCells.length < 1) continue;
    const boxes = new Set(
      candidateCells.map((k) => boxOf(Math.floor(k / 9), k % 9)),
    );
    if (boxes.size === 1 && [...boxes][0] === targetBox) return null;
  }
  return `no line claims ${digit} into the target's box`;
}

function validateFish(
  c: Challenge,
  cands: Map<number, Set<number>>,
  n: number,
): string | null {
  if (c.question.kind !== "select-cells") return "expected select-cells";
  if (c.question.cells.length !== n * n)
    return `fish expects ${n * n} cells, got ${c.question.cells.length}`;
  // Must form n rows × n cols. Find the digit shared by all n*n cells.
  const keys = c.question.cells.map((p) => cellKey(p.row, p.col));
  const rows = new Set(c.question.cells.map((p) => p.row));
  const cols = new Set(c.question.cells.map((p) => p.col));
  if (rows.size !== n) return `fish must use ${n} rows, got ${rows.size}`;
  if (cols.size !== n) return `fish must use ${n} cols, got ${cols.size}`;
  // The shared digit must exist as a candidate in every fish cell.
  for (let d = 1; d <= 9; d++) {
    if (!keys.every((k) => cands.get(k)?.has(d))) continue;
    // Now check: in each of the n rows, the digit's candidate cells must
    // sit ONLY within the n cols (no digit candidates leaking outside).
    let valid = true;
    for (const row of rows) {
      const rowCells = cellsInRow(row);
      const cellsWith = cellsWithDigit(cands, rowCells, d);
      if (!cellsWith.every((k) => cols.has(k % 9))) {
        valid = false;
        break;
      }
    }
    if (valid) return null;
  }
  return `no digit is locked into the ${n}×${n} fish formed by the chosen cells`;
}

function validateYWing(
  c: Challenge,
  cands: Map<number, Set<number>>,
): string | null {
  if (c.question.kind !== "select-cells") return "expected select-cells";
  if (c.question.cells.length !== 3)
    return `y-wing expects 3 cells, got ${c.question.cells.length}`;
  // Each cell must be a bi-value cell.
  const cells = c.question.cells;
  const sets = cells.map((p) => cands.get(cellKey(p.row, p.col)));
  for (let i = 0; i < 3; i++) {
    if (!sets[i] || sets[i]!.size !== 2)
      return `cell ${i} must be bi-value, got size ${sets[i]?.size ?? "none"}`;
  }
  // Try each cell as pivot.
  for (let pivot = 0; pivot < 3; pivot++) {
    const w1 = (pivot + 1) % 3;
    const w2 = (pivot + 2) % 3;
    const pivotSet = sets[pivot]!;
    const w1Set = sets[w1]!;
    const w2Set = sets[w2]!;
    const sharedPivotW1 = [...pivotSet].filter((d) => w1Set.has(d));
    const sharedPivotW2 = [...pivotSet].filter((d) => w2Set.has(d));
    if (sharedPivotW1.length !== 1 || sharedPivotW2.length !== 1) continue;
    const X = sharedPivotW1[0]!;
    const Y = sharedPivotW2[0]!;
    if (X === Y) continue;
    // Z = the third digit shared by w1 and w2.
    const Zw1 = [...w1Set].find((d) => d !== X);
    const Zw2 = [...w2Set].find((d) => d !== Y);
    if (Zw1 !== Zw2 || Zw1 === undefined) continue;
    // Pivot must share a unit with each wing.
    const p = cells[pivot]!;
    const ww1 = cells[w1]!;
    const ww2 = cells[w2]!;
    const sees = (a: { row: number; col: number }, b: typeof a) =>
      a.row === b.row ||
      a.col === b.col ||
      boxOf(a.row, a.col) === boxOf(b.row, b.col);
    if (sees(p, ww1) && sees(p, ww2)) return null;
  }
  return `the three cells don't form a valid Y-Wing`;
}

// ─── Test suite ───────────────────────────────────────────────────────

describe("guide challenges", () => {
  for (const guide of GUIDES) {
    describe(guide.id, () => {
      for (const ch of guide.challenges ?? []) {
        it(`${ch.id}: matches the technique invariant`, () => {
          const cands = visibleCandidates(ch);
          const validator = VALIDATORS[guide.id];
          const err = validator(ch, cands);
          if (err) {
            throw new Error(`${guide.id}/${ch.id}: ${err}`);
          }
          expect(err).toBeNull();
        });
      }
    });
  }
});
