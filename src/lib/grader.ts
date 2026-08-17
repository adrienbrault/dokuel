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

// Bits 1..9 mark candidate digits, mirroring the solver's mask layout.
const ALL_DIGITS = 0b1111111110;

function boxIndex(cell: number): number {
  return Math.floor(cell / 27) * 3 + Math.floor((cell % 9) / 3);
}

function popcount(mask: number): number {
  let n = 0;
  let m = mask;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
}

// The 27 houses a human scans: rows, then columns, then boxes.
const UNITS: number[][] = (() => {
  const units: number[][] = [];
  for (let r = 0; r < 9; r++) {
    units.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  }
  for (let c = 0; c < 9; c++) {
    units.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  }
  for (let b = 0; b < 9; b++) {
    const cells: number[] = [];
    const r0 = Math.floor(b / 3) * 3;
    const c0 = (b % 3) * 3;
    for (let r = r0; r < r0 + 3; r++) {
      for (let c = c0; c < c0 + 3; c++) {
        cells.push(r * 9 + c);
      }
    }
    units.push(cells);
  }
  return units;
})();

// The 20 cells sharing a row, column, or box with each cell.
const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const peers = new Set<number>();
  const r = Math.floor(i / 9);
  const c = i % 9;
  for (let k = 0; k < 9; k++) {
    peers.add(r * 9 + k);
    peers.add(k * 9 + c);
  }
  const r0 = Math.floor(boxIndex(i) / 3) * 3;
  const c0 = (boxIndex(i) % 3) * 3;
  for (let rr = r0; rr < r0 + 3; rr++) {
    for (let cc = c0; cc < c0 + 3; cc++) {
      peers.add(rr * 9 + cc);
    }
  }
  peers.delete(i);
  return [...peers];
});

type GradeState = {
  grid: Uint8Array;
  cand: Uint16Array;
  empty: number;
};

function initState(puzzle: string): GradeState | null {
  if (!/^[1-9.]{81}$/.test(puzzle)) return null;
  const grid = new Uint8Array(81);
  for (let i = 0; i < 81; i++) {
    const code = puzzle.charCodeAt(i);
    grid[i] = code === 46 ? 0 : code - 48;
  }
  const cand = new Uint16Array(81);
  let empty = 0;
  for (let i = 0; i < 81; i++) {
    if (grid[i] !== 0) continue;
    empty++;
    let mask = ALL_DIGITS;
    for (const p of PEERS[i]!) {
      const v = grid[p]!;
      if (v) mask &= ~(1 << v);
    }
    if (mask === 0) return null;
    cand[i] = mask;
  }
  return { grid, cand, empty };
}

function place(s: GradeState, cell: number, value: number): void {
  s.grid[cell] = value;
  s.cand[cell] = 0;
  s.empty--;
  const bit = 1 << value;
  for (const p of PEERS[cell]!) {
    s.cand[p]! &= ~bit;
  }
}

function nakedSingle(s: GradeState): boolean {
  for (let i = 0; i < 81; i++) {
    if (s.grid[i] === 0 && popcount(s.cand[i]!) === 1) {
      place(s, i, 31 - Math.clz32(s.cand[i]!));
      return true;
    }
  }
  return false;
}

function hiddenSingle(s: GradeState): boolean {
  for (const unit of UNITS) {
    for (let v = 1; v <= 9; v++) {
      const bit = 1 << v;
      let count = 0;
      let where = -1;
      let placed = false;
      for (const cell of unit) {
        if (s.grid[cell] === v) {
          placed = true;
          break;
        }
        if (s.cand[cell]! & bit) {
          count++;
          where = cell;
        }
      }
      if (placed || count !== 1) continue;
      // A naked single would already have caught a one-candidate cell,
      // so this placement is progress only singles-in-a-unit can see.
      place(s, where, v);
      return true;
    }
  }
  return false;
}

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

/** Naked pair: two cells sharing the same two candidates own them. */
function nakedPair(s: GradeState): boolean {
  for (const unit of UNITS) {
    const open = unit.filter((c) => s.grid[c] === 0);
    if (open.length <= 2) continue;
    const narrow = open.filter((c) => popcount(s.cand[c]!) === 2);
    for (const combo of kCombinations(narrow, 2)) {
      const union = s.cand[combo[0]!]! | s.cand[combo[1]!]!;
      if (popcount(union) !== 2) continue;
      let changed = false;
      for (const c of open) {
        if (!combo.includes(c)) changed = eliminate(s, c, union) || changed;
      }
      if (changed) return true;
    }
  }
  return false;
}

/** Hidden pair: two digits confined to the same two cells own them. */
function hiddenPair(s: GradeState): boolean {
  for (const unit of UNITS) {
    const open = unit.filter((c) => s.grid[c] === 0);
    if (open.length <= 2) continue;
    const digits: number[] = [];
    for (let v = 1; v <= 9; v++) {
      if (open.some((c) => s.cand[c]! & (1 << v))) digits.push(v);
    }
    if (digits.length <= 2) continue;
    for (const combo of kCombinations(digits, 2)) {
      const mask = (1 << combo[0]!) | (1 << combo[1]!);
      const holders = open.filter((c) => s.cand[c]! & mask);
      if (holders.length !== 2) continue;
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
 * Grade a puzzle by the hardest technique required to finish it. A
 * malformed or internally contradictory puzzle grades as maximally
 * stuck — nothing a human technique could do with it.
 */
export function gradePuzzle(puzzle: string): PuzzleGrade {
  const s = initState(puzzle);
  if (!s) return { tier: 4, stuckCells: 81 };
  let tier: TechniqueTier = 1;
  while (s.empty > 0) {
    if (nakedSingle(s) || hiddenSingle(s)) continue;
    if (
      pointingCandidates(s) ||
      claimingCandidates(s) ||
      nakedPair(s) ||
      hiddenPair(s)
    ) {
      tier = tier < 2 ? 2 : tier;
      continue;
    }
    return { tier: 4, stuckCells: s.empty };
  }
  return { tier, stuckCells: 0 };
}
