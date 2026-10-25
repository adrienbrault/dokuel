import { useEffect, useMemo, useRef } from "react";
import { serializeBoard } from "../lib/board-engine.ts";
import type { Board, GameStatus, MoveAction } from "../lib/types.ts";
import { useMistakeReporter } from "./useMistakeReporter.ts";

type Options = {
  puzzle: string;
  board: Board;
  status: GameStatus;
  cellsRemaining: number;
  onProgress: (cellsRemaining: number, completionPercent: number) => void;
  onComplete: (board: string) => void;
  /** Our latest move, judged against the solution for mistakes. */
  lastMove?: MoveAction | undefined;
  solution?: string | null | undefined;
  onMistake?: (() => void) | undefined;
};

const ignoreMistake = () => {};

/**
 * Reports one player's race to the room: progress whenever the count
 * of empty cells moves, each wrong digit we place, and the completed
 * board once it is solved.
 * Returns how much of the board we have filled, in percent.
 */
export function useRaceReporting({
  puzzle,
  board,
  status,
  cellsRemaining,
  onProgress,
  onComplete,
  lastMove,
  solution = null,
  onMistake = ignoreMistake,
}: Options): number {
  useMistakeReporter(lastMove, solution, onMistake);
  const prevCellsRef = useRef(cellsRemaining);

  const myPercent = useMemo(() => {
    const total = 81 - puzzle.split("").filter((c) => c !== ".").length;
    const filled = total - cellsRemaining;
    return total > 0 ? Math.round((filled / total) * 100) : 0;
  }, [cellsRemaining, puzzle]);

  useEffect(() => {
    if (prevCellsRef.current !== cellsRemaining) {
      prevCellsRef.current = cellsRemaining;
      onProgress(cellsRemaining, myPercent);
    }
  }, [cellsRemaining, onProgress, myPercent]);

  // The claim ships the actual filled board so the opponent's client
  // can verify it against the room's solution.
  useEffect(() => {
    if (status !== "completed") return;
    onComplete(serializeBoard(board).values);
  }, [status, board, onComplete]);

  return myPercent;
}
