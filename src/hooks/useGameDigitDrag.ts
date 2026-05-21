import { useCallback } from "react";
import { gameFeedback } from "../lib/game-feedback.ts";
import type { Board, Position } from "../lib/types.ts";
import {
  type DigitDragSource,
  type DigitDropMode,
  useDigitDrag,
} from "./useDigitDrag.ts";

type Game = {
  board: Board;
  selectCell: (row: number, col: number) => void;
  deselectCell: () => void;
  placeNumber: (
    value: number,
    autoEliminateNotes?: boolean,
    asNote?: boolean,
  ) => void;
  placeNoteAt: (row: number, col: number, value: number) => void;
};

type Options = {
  game: Game;
  /** When true (paused, game over, ...), drag-starts are ignored and drops no-op. */
  disabled?: boolean | undefined;
  /** Auto-eliminate peer notes when committing the dropped value. */
  autoEliminateNotes: boolean;
  /**
   * Highlight a digit board-wide. A note dragged from the numpad keeps
   * the highlight on that digit instead of jumping to the drop target.
   */
  onHighlightDigit: (digit: number) => void;
  /**
   * Forwarded to the drag layer: fires when a numpad drag is brought
   * back over the numpad, so the caller can resume a numpad skim.
   */
  onReturnToNumpad?:
    | ((info: {
        digit: number;
        pointerId: number;
        pointerType: string;
      }) => void)
    | undefined;
};

/**
 * Bundles the digit drag-and-drop wiring shared by SoloGame and
 * MultiplayerBoard. The drop zone within the cell decides intent: the
 * top half commits the value, the bottom half adds a note.
 *
 * A value drop selects the cell it lands in. A note drop deliberately
 * does not — selection follows what was dragged (the source cell, or
 * the dragged digit's board-wide highlight) so repeated note drops
 * leave the highlight where the player is working.
 *
 * Start handlers gate themselves on the caller's disabled flag.
 */
export function useGameDigitDrag({
  game,
  disabled,
  autoEliminateNotes,
  onHighlightDigit,
  onReturnToNumpad,
}: Options) {
  const isDroppable = useCallback(
    (row: number, col: number) => {
      const cell = game.board[row]?.[col];
      if (!cell) return false;
      return !cell.isGiven && cell.value === null;
    },
    [game.board],
  );

  const onDrop = useCallback(
    (
      digit: number,
      source: DigitDragSource,
      target: Position,
      mode: DigitDropMode,
    ) => {
      if (disabled) return;
      gameFeedback.onPlace();
      if (mode === "note") {
        // A note drop must not pull the selection onto the drop target
        // — that would yank the board highlight to wherever the note
        // landed. The note lands at `target`; selection instead
        // follows what was dragged, so penciling one digit across
        // several cells keeps a stable highlight.
        game.placeNoteAt(target.row, target.col, digit);
        if (source.kind === "cell") {
          game.selectCell(source.row, source.col);
        } else {
          game.deselectCell();
          onHighlightDigit(digit);
        }
        return;
      }
      game.selectCell(target.row, target.col);
      game.placeNumber(digit, autoEliminateNotes, false);
    },
    [
      disabled,
      game.selectCell,
      game.deselectCell,
      game.placeNumber,
      game.placeNoteAt,
      autoEliminateNotes,
      onHighlightDigit,
    ],
  );

  const { state: dragState, start } = useDigitDrag({
    onDrop,
    isDroppable,
    onReturnToNumpad,
  });

  const startNumpadDrag = useCallback(
    (args: {
      digit: number;
      x: number;
      y: number;
      pointerId: number;
      pointerType: string;
    }) => {
      if (disabled) return;
      start({ ...args, source: { kind: "numpad" } });
    },
    [disabled, start],
  );

  const startCellDrag = useCallback(
    (args: {
      digit: number;
      from: Position;
      x: number;
      y: number;
      pointerId: number;
      pointerType: string;
    }) => {
      if (disabled) return;
      start({
        digit: args.digit,
        source: { kind: "cell", row: args.from.row, col: args.from.col },
        x: args.x,
        y: args.y,
        pointerId: args.pointerId,
        pointerType: args.pointerType,
      });
    },
    [disabled, start],
  );

  return { dragState, startNumpadDrag, startCellDrag };
}
