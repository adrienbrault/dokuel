import { useCallback } from "react";
import { gameFeedback } from "../lib/game-feedback.ts";
import type { Board, Position } from "../lib/types.ts";
import { type DigitDragSource, useDigitDrag } from "./useDigitDrag.ts";

type Game = {
  board: Board;
  selectCell: (row: number, col: number) => void;
  placeNumber: (
    value: number,
    autoEliminateNotes?: boolean,
    asNote?: boolean,
  ) => void;
};

type Options = {
  game: Game;
  /** When true (paused, game over, ...), drag-starts are ignored and drops no-op. */
  disabled?: boolean | undefined;
  /** Auto-eliminate peer notes when committing the dropped value. */
  autoEliminateNotes: boolean;
};

/**
 * Bundles the digit drag-and-drop wiring shared by SoloGame and
 * MultiplayerBoard: the drop commits the dragged digit as a VALUE at
 * the target cell, and the start handlers gate themselves on the
 * caller's disabled flag.
 */
export function useGameDigitDrag({
  game,
  disabled,
  autoEliminateNotes,
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
    (digit: number, _source: DigitDragSource, target: Position) => {
      if (disabled) return;
      gameFeedback.onPlace();
      game.selectCell(target.row, target.col);
      game.placeNumber(digit, autoEliminateNotes, false);
    },
    [disabled, game.selectCell, game.placeNumber, autoEliminateNotes],
  );

  const { state: dragState, start } = useDigitDrag({ onDrop, isDroppable });

  const startNumpadDrag = useCallback(
    (args: { digit: number; x: number; y: number; pointerId: number }) => {
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
    }) => {
      if (disabled) return;
      start({
        digit: args.digit,
        source: { kind: "cell", row: args.from.row, col: args.from.col },
        x: args.x,
        y: args.y,
        pointerId: args.pointerId,
      });
    },
    [disabled, start],
  );

  return { dragState, startNumpadDrag, startCellDrag };
}
