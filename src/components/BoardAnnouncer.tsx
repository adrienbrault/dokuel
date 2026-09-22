import { useEffect, useRef, useState } from "react";
import { describeBoardChange } from "../lib/board-announcement.ts";
import type { Board } from "../lib/types.ts";

/**
 * How long input must settle before a move is announced. Rapid entry
 * (typing digits, undo bursts) restarts the wait, so only the outcome
 * is spoken instead of a queue of stale steps.
 */
const SETTLE_MS = 250;

const NBSP = String.fromCharCode(0xa0);

type BoardAnnouncerProps = {
  board: Board;
  conflicts: Set<number>;
  /** Flips true when the puzzle is solved; announced over the last move. */
  completed?: boolean | undefined;
};

/**
 * Visually hidden polite live region that speaks the outcome of each
 * board move. Placing a digit only changes a cell's label, which screen
 * readers rarely re-read, and numpad taps never move focus.
 */
export function BoardAnnouncer({
  board,
  conflicts,
  completed = false,
}: BoardAnnouncerProps) {
  // Repeating the same sentence (for example placing, undoing, and
  // placing the same digit) must still be heard, so a counter toggles a
  // trailing no-break space to make the text node actually change.
  const [message, setMessage] = useState({ text: "", count: 0 });
  const prevBoardRef = useRef(board);
  const prevCompletedRef = useRef(completed);
  const conflictsRef = useRef(conflicts);
  conflictsRef.current = conflicts;

  useEffect(() => {
    const prev = prevBoardRef.current;
    prevBoardRef.current = board;
    const justCompleted = completed && !prevCompletedRef.current;
    prevCompletedRef.current = completed;
    // Completion supersedes the final placement; re-running this effect
    // on the flip also cancels that placement's pending announcement.
    const text = justCompleted
      ? "Puzzle complete"
      : prev === board
        ? null
        : describeBoardChange(prev, board, conflictsRef.current);
    if (text === null) return;
    const id = setTimeout(
      () => setMessage((m) => ({ text, count: m.count + 1 })),
      SETTLE_MS,
    );
    return () => clearTimeout(id);
  }, [board, completed]);

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message.text}
      {message.count % 2 === 1 ? NBSP : ""}
    </div>
  );
}
