import { useEffect, useRef } from "react";
import type { MoveAction } from "../lib/types.ts";

/**
 * Calls `onMistake` once per wrong digit we place. Moves are tracked by
 * identity rather than by history length: the log is capped, and an
 * undo brings back a move we have already judged.
 */
export function useMistakeReporter(
  lastMove: MoveAction | undefined,
  solution: string | null,
  onMistake: () => void,
) {
  const judged = useRef(new WeakSet<MoveAction>());

  useEffect(() => {
    if (!lastMove || judged.current.has(lastMove)) return;
    judged.current.add(lastMove);
    if (lastMove.type !== "place" || !solution) return;
    const { row, col } = lastMove.position;
    if (solution[row * 9 + col] !== String(lastMove.value)) onMistake();
  }, [lastMove, solution, onMistake]);
}
