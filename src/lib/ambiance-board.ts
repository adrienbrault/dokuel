import type { AmbianceEvent } from "./ambiance.ts";
import type { Board } from "./types.ts";

/**
 * What changed between two renders of a board, in the scene's terms:
 * which cells just took a value. Undo and hints go through here too;
 * both put a value on the board the player can see land.
 */
export function diffBoardForAmbiance(
  prev: Board,
  next: Board,
  _conflicts: ReadonlySet<number>,
): AmbianceEvent[] {
  const events: AmbianceEvent[] = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const value = next[row]?.[col]?.value ?? null;
      if (value === null || value === prev[row]?.[col]?.value) continue;
      events.push({ type: "place", row, col, digit: value });
    }
  }
  return events;
}
