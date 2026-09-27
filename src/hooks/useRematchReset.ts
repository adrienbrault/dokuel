import { useEffect, useRef } from "react";
import type { SavedBoard } from "./useSudoku.ts";

/**
 * On rematch, the Yjs room bumps gameNumber and assigns a new puzzle.
 * Resets the reducer in place rather than remounting the whole subtree:
 * keeps the timer ref, num-pad position, and any other UI state alive.
 * The puzzle is tracked too: after a concurrent start/rematch merge the
 * number can stay put while the puzzle changes under us.
 */
export function useRematchReset({
  gameNumber,
  puzzle,
  solution,
  savedBoard,
  reset,
  onReset,
}: {
  gameNumber: number;
  puzzle: string;
  solution: string | null | undefined;
  savedBoard: SavedBoard | undefined;
  reset: (puzzle: string, solution?: string, saved?: SavedBoard) => void;
  onReset: () => void;
}) {
  const prevGameNumberRef = useRef(gameNumber);
  const prevPuzzleRef = useRef(puzzle);
  // biome-ignore lint/correctness/useExhaustiveDependencies: onReset is a fresh closure each render; only a new game should fire it
  useEffect(() => {
    if (
      gameNumber === prevGameNumberRef.current &&
      puzzle === prevPuzzleRef.current
    ) {
      return;
    }
    prevGameNumberRef.current = gameNumber;
    prevPuzzleRef.current = puzzle;
    reset(puzzle, solution ?? undefined, savedBoard);
    onReset();
  }, [gameNumber, puzzle, solution, savedBoard, reset]);
}
