import { useEffect, useRef, useState } from "react";
import { describeBoardChange } from "../lib/board-announcement.ts";
import type { Board } from "../lib/types.ts";

/**
 * How long input must settle before a move is announced. Rapid entry
 * (typing digits, undo bursts) restarts the wait, so only the outcome
 * is spoken instead of a queue of stale steps.
 */
const SETTLE_MS = 250;

type BoardAnnouncerProps = {
  board: Board;
  conflicts: Set<number>;
};

/**
 * Visually hidden polite live region that speaks the outcome of each
 * board move. Placing a digit only changes a cell's label, which screen
 * readers rarely re-read, and numpad taps never move focus.
 */
export function BoardAnnouncer({ board, conflicts }: BoardAnnouncerProps) {
  // Repeating the same sentence (for example placing, undoing, and
  // placing the same digit) must still be heard, so a counter toggles a
  // trailing no-break space to make the text node actually change.
  const [message, setMessage] = useState({ text: "", count: 0 });
  const prevBoardRef = useRef(board);
  const conflictsRef = useRef(conflicts);
  conflictsRef.current = conflicts;

  useEffect(() => {
    const prev = prevBoardRef.current;
    prevBoardRef.current = board;
    if (prev === board) return;
    const text = describeBoardChange(prev, board, conflictsRef.current);
    if (text === null) return;
    const id = setTimeout(
      () => setMessage((m) => ({ text, count: m.count + 1 })),
      SETTLE_MS,
    );
    return () => clearTimeout(id);
  }, [board]);

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message.text}
      {message.count % 2 === 1 ? " " : ""}
    </div>
  );
}
