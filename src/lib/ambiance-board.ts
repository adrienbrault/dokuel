import type { AmbianceEvent } from "./ambiance.ts";
import type { Board } from "./types.ts";

type UnitKind = "row" | "col" | "box";

const UNIT_KINDS: UnitKind[] = ["row", "col", "box"];

/** The nine cells of a unit, as [row, col] pairs. */
function unitCells(kind: UnitKind, index: number): [number, number][] {
  const cells: [number, number][] = [];
  for (let i = 0; i < 9; i++) {
    if (kind === "row") cells.push([index, i]);
    else if (kind === "col") cells.push([i, index]);
    else {
      const boxRow = Math.floor(index / 3) * 3;
      const boxCol = (index % 3) * 3;
      cells.push([boxRow + Math.floor(i / 3), boxCol + (i % 3)]);
    }
  }
  return cells;
}

function unitIndex(kind: UnitKind, row: number, col: number): number {
  if (kind === "row") return row;
  if (kind === "col") return col;
  return Math.floor(row / 3) * 3 + Math.floor(col / 3);
}

/**
 * What changed between two renders of a board, in the scene's terms:
 * which cells just took a value, and whether that value clashes
 * (the caller passes conflicts or solution errors, whichever the
 * assist level shows the player), then which units those values just
 * closed. Undo and hints go through here too; both put a value on the
 * board the player can see land.
 */
export function diffBoardForAmbiance(
  prev: Board,
  next: Board,
  conflicts: ReadonlySet<number>,
): AmbianceEvent[] {
  const events: AmbianceEvent[] = [];
  const touched: [number, number][] = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const cell = next[row]?.[col];
      const value = cell?.value ?? null;
      // Givens arrive with the puzzle, not from the player.
      if (value === null || cell?.isGiven) continue;
      if (value === prev[row]?.[col]?.value) continue;
      touched.push([row, col]);
      events.push(
        conflicts.has(row * 9 + col)
          ? { type: "conflict", row, col }
          : { type: "place", row, col, digit: value },
      );
    }
  }

  for (const kind of UNIT_KINDS) {
    const indices = new Set(touched.map(([r, c]) => unitIndex(kind, r, c)));
    for (const index of [...indices].sort((a, b) => a - b)) {
      const complete = unitCells(kind, index).every(
        ([r, c]) =>
          (next[r]?.[c]?.value ?? null) !== null && !conflicts.has(r * 9 + c),
      );
      if (complete) events.push({ type: "unit", kind, index });
    }
  }
  return events;
}
