import type { AmbianceEvent } from "./ambiance.ts";
import type { Board } from "./types.ts";

/**
 * What changed between two renders of a board, in the scene's terms:
 * which cells just took a value, and whether that value clashes
 * (the caller passes conflicts or solution errors, whichever the
 * assist level shows the player). Undo and hints go through here too;
 * both put a value on the board the player can see land.
 */
export function diffBoardForAmbiance(
  prev: Board,
  next: Board,
  conflicts: ReadonlySet<number>,
): AmbianceEvent[] {
  const events: AmbianceEvent[] = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const value = next[row]?.[col]?.value ?? null;
      if (value === null || value === prev[row]?.[col]?.value) continue;
      events.push(
        conflicts.has(row * 9 + col)
          ? { type: "conflict", row, col }
          : { type: "place", row, col, digit: value },
      );
    }
  }
  return events;
}
