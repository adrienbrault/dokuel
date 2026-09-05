import { serializeBoard } from "./board-engine.ts";
import {
  type MultiplayerGameIdentity,
  type SavedGame,
  saveMultiplayerGame,
} from "./game-storage.ts";
import type { Cell } from "./types.ts";

/** A rematch may update identity before the reducer resets the old board.
 * Keep that transition from writing old cells under the new puzzle's key. */
export function saveMultiplayerBoard(
  identity: MultiplayerGameIdentity,
  board: readonly (readonly Cell[])[],
  progress: Pick<
    SavedGame,
    "timer" | "difficulty" | "assistLevel" | "hintsUsed"
  >,
): void {
  const matches = board.every((row, r) =>
    row.every((cell, c) => {
      const given = identity.puzzle[r * 9 + c];
      return given === "."
        ? !cell.isGiven
        : cell.isGiven && cell.value === Number(given);
    }),
  );
  if (!matches) return;
  const { values, notes } = serializeBoard(board as Cell[][]);
  saveMultiplayerGame(identity, {
    puzzle: identity.puzzle,
    values,
    notes,
    ...progress,
  });
}
