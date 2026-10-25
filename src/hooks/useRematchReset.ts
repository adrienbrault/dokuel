import { useEffect, useRef } from "react";

/**
 * Runs `onNewGame` when the room deals a new board: a bumped game
 * number, or the same number with a different puzzle, which is what a
 * concurrent start/rematch merge leaves behind. Never on mount.
 */
export function useRematchReset(
  gameNumber: number,
  puzzle: string,
  onNewGame: () => void,
) {
  const prev = useRef({ gameNumber, puzzle });
  const latest = useRef(onNewGame);
  latest.current = onNewGame;

  useEffect(() => {
    if (
      gameNumber === prev.current.gameNumber &&
      puzzle === prev.current.puzzle
    ) {
      return;
    }
    prev.current = { gameNumber, puzzle };
    latest.current();
  }, [gameNumber, puzzle]);
}
