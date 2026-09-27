import { useEffect, useRef } from "react";
import { ambiance } from "../lib/ambiance.ts";
import { diffBoardForAmbiance } from "../lib/ambiance-board.ts";
import type { Board, GameStatus } from "../lib/types.ts";

/** Share of the non-given cells that hold a value, 0..1. */
function fillFraction(board: Board): number {
  let open = 0;
  let filled = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell.isGiven) continue;
      open += 1;
      if (cell.value !== null) filled += 1;
    }
  }
  return open === 0 ? 1 : filled / open;
}

/**
 * Tells the ambiance what is happening on this board. Diffing renders
 * rather than hooking each action means typing, dragging, hints and
 * undo all light the world without each remembering to. The board it
 * mounts with is the baseline, so resuming a game replays nothing.
 *
 * @param clashes the conflicts or solution errors the player is shown.
 */
export function useAmbianceBoard(
  board: Board,
  clashes: ReadonlySet<number>,
  status: GameStatus,
) {
  const previous = useRef(board);

  useEffect(() => {
    const prev = previous.current;
    previous.current = board;
    if (prev !== board) {
      for (const event of diffBoardForAmbiance(prev, board, clashes)) {
        ambiance.emit(event);
      }
    }
    ambiance.setProgress(fillFraction(board));
  }, [board, clashes]);

  useEffect(() => {
    if (status === "completed") ambiance.emit({ type: "victory" });
  }, [status]);
}

/**
 * Ripples the rival's board once per cell the opponent fills. Their
 * first report is the baseline (joining mid-game replays nothing), and
 * a count going back up is an undo, not a move.
 */
export function useAmbianceRival(cellsRemaining: number | null) {
  const previous = useRef(cellsRemaining);

  useEffect(() => {
    const prev = previous.current;
    previous.current = cellsRemaining;
    if (prev === null || cellsRemaining === null) return;
    // Capped: a burst after a reconnect is one flurry, not fifty.
    const moves = Math.min(prev - cellsRemaining, 3);
    for (let i = 0; i < moves; i++) ambiance.emit({ type: "rival" });
  }, [cellsRemaining]);
}
