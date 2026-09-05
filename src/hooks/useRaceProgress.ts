import { useEffect, useMemo, useRef } from "react";
import { filledMask, serializeBoard } from "../lib/board-engine.ts";
import type { Board, Cell, GameStatus } from "../lib/types.ts";

/**
 * Everything one racer publishes about their own board, and the one
 * number they read back off it.
 *
 * Three things leave this board, on three different channels and for
 * three different reasons: a completion percentage the room syncs as
 * durable state, a silhouette that rides ephemeral presence, and the
 * finished board itself, which is a win claim the opponent verifies.
 * Keeping them together makes it obvious that they are not the same
 * thing wearing three names.
 */

export type RaceProgressOptions = {
  board: Board;
  cellsRemaining: number;
  status: GameStatus;
  puzzle: string;
  /** Durable, synced through the room. */
  onProgress: (cellsRemaining: number, completionPercent: number) => void;
  /** Ephemeral, published over presence. Throttled downstream. */
  onMask: (mask: string) => void;
  /** The win claim, shipped so the opponent can check it themselves. */
  onComplete: (board: string) => void;
};

function completionPercent(puzzle: string, cellsRemaining: number): number {
  const total = 81 - puzzle.split("").filter((c) => c !== ".").length;
  const filled = total - cellsRemaining;
  return total > 0 ? Math.round((filled / total) * 100) : 0;
}

/** Returns this player's completion percentage for the header. */
export function useRaceProgress({
  board,
  cellsRemaining,
  status,
  puzzle,
  onProgress,
  onMask,
  onComplete,
}: RaceProgressOptions): number {
  const prevCellsRef = useRef(cellsRemaining);

  const myPercent = useMemo(
    () => completionPercent(puzzle, cellsRemaining),
    [cellsRemaining, puzzle],
  );

  // Only on a real change: the reducer publishes a fresh board on every
  // note and selection too, and none of that moves the bar.
  useEffect(() => {
    if (prevCellsRef.current === cellsRemaining) return;
    prevCellsRef.current = cellsRemaining;
    onProgress(cellsRemaining, completionPercent(puzzle, cellsRemaining));
  }, [cellsRemaining, onProgress, puzzle]);

  // Which cells are filled is race information, not game state. It
  // rides presence, so it costs nothing to send often and disappears
  // with the player.
  useEffect(() => {
    onMask(filledMask(board));
  }, [board, onMask]);

  // The claim ships the actual filled board so the opponent's client
  // can verify it against the room's solution.
  useEffect(() => {
    if (status !== "completed") return;
    onComplete(serializeBoard(board as Cell[][]).values);
  }, [status, board, onComplete]);

  return myPercent;
}
