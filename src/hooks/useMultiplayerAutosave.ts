import { type RefObject, useEffect } from "react";
import { serializeBoard } from "../lib/board-engine.ts";
import { deleteGame, saveGame } from "../lib/game-storage.ts";
import type {
  AssistLevel,
  Board,
  Cell,
  Difficulty,
  GameStatus,
} from "../lib/types.ts";

type Options = {
  gameKey: string;
  puzzle: string;
  board: Board;
  status: GameStatus;
  hintsUsed: number;
  /** Read at save time: the clock ticks without re-rendering the board. */
  timerSecondsRef: RefObject<number>;
  difficulty: Difficulty;
  assistLevel: AssistLevel;
};

/**
 * Keeps the local multiplayer board in localStorage until this player
 * finishes it.
 */
export function useMultiplayerAutosave({
  gameKey,
  puzzle,
  board,
  status,
  hintsUsed,
  timerSecondsRef,
  difficulty,
  assistLevel,
}: Options) {
  // Autosave the local board so a transient unmount/remount or page
  // refresh doesn't wipe in-flight progress. The Yjs doc only carries
  // the puzzle + opponent progress; the filled cells live here.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the clock is read at save time; a tick alone must not trigger a save
  useEffect(() => {
    if (status === "completed") return;
    // On rematch this effect and the RESET dispatch share a commit: the
    // reducer still holds the OLD game's board while gameKey already
    // points at the new one. Writing that mix would resume game 2
    // wearing game 1's cells if the tab dies before the next render.
    const boardMatchesPuzzle = board.every((boardRow, r) =>
      boardRow.every((boardCell, c) => {
        const ch = puzzle[r * 9 + c];
        return ch === "."
          ? !boardCell.isGiven
          : boardCell.isGiven && boardCell.value === Number(ch);
      }),
    );
    if (!boardMatchesPuzzle) return;
    const { values, notes } = serializeBoard(board as Cell[][]);
    saveGame(gameKey, {
      puzzle,
      values,
      notes,
      timer: timerSecondsRef.current,
      difficulty,
      assistLevel,
      hintsUsed,
    });
  }, [board, status, hintsUsed, gameKey, puzzle, difficulty, assistLevel]);

  // Clear the save once this player finishes — keyed off local status so
  // the loser's in-progress save survives the opponent's win.
  useEffect(() => {
    if (status === "completed") deleteGame(gameKey);
  }, [status, gameKey]);
}
