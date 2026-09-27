import { UNITS } from "./board-geometry.ts";
import type { Board } from "./types.ts";

export type BoardEvents = {
  /** Cells (row * 9 + col) that gained a value or changed digit. */
  placed: number[];
  /** Cells that lost their value. */
  cleared: number[];
  /** Indices into UNITS (rows, then columns, then boxes) that just
   *  became full with nine distinct digits. */
  completedUnits: number[];
};

function valueAt(board: Board, cell: number) {
  return board[Math.floor(cell / 9)]![cell % 9]!.value;
}

function isUnitComplete(board: Board, unit: number[]): boolean {
  const seen = new Set<number>();
  for (const cell of unit) {
    const v = valueAt(board, cell);
    if (v === null || seen.has(v)) return false;
    seen.add(v);
  }
  return true;
}

/**
 * What changed between two snapshots of the same board, as the moments
 * a renderer wants to animate.
 */
export function diffBoards(prev: Board, next: Board): BoardEvents {
  const placed: number[] = [];
  const cleared: number[] = [];
  for (let i = 0; i < 81; i++) {
    const a = valueAt(prev, i);
    const b = valueAt(next, i);
    if (a === b) continue;
    if (b === null) cleared.push(i);
    else placed.push(i);
  }
  const completedUnits: number[] = [];
  if (placed.length > 0) {
    UNITS.forEach((unit, u) => {
      if (isUnitComplete(next, unit) && !isUnitComplete(prev, unit)) {
        completedUnits.push(u);
      }
    });
  }
  return { placed, cleared, completedUnits };
}
