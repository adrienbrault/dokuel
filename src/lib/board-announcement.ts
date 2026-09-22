import { cellKey } from "./sudoku.ts";
import type { Board } from "./types.ts";

function position(row: number, col: number): string {
  return `row ${row + 1} column ${col + 1}`;
}

/**
 * One short sentence describing what changed between two boards, for a
 * polite live region. Returns null when there is nothing worth saying.
 */
export function describeBoardChange(
  prev: Board,
  next: Board,
  conflicts: Set<number>,
): string | null {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const before = prev[r]?.[c]?.value ?? null;
      const after = next[r]?.[c]?.value ?? null;
      if (after === before) continue;
      if (after === null) return `${before} erased, ${position(r, c)}`;
      const conflict = conflicts.has(cellKey(r, c)) ? ", conflict" : "";
      return `${after} placed, ${position(r, c)}${conflict}`;
    }
  }
  return null;
}
