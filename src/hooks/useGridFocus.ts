import { type RefObject, useEffect, useId } from "react";
import type { Position } from "../lib/types.ts";

/**
 * Keyboard focus plumbing for the board's ARIA grid.
 *
 * - `cellId` gives every cell a page-unique DOM id, so ARIA rows can
 *   adopt their cells through aria-owns.
 * - `tabStop` is the one cell the roving tabindex lets Tab land on: the
 *   selected cell, or the top-left one when nothing is selected.
 * - While focus is already inside the grid, focus follows the selection,
 *   so arrow-key moves (made by the game's keyboard hook) land the
 *   screen reader on the new cell. Focus elsewhere is never stolen.
 */
export function useGridFocus(
  gridRef: RefObject<HTMLElement | null>,
  selectedCell: Position | null,
) {
  const idPrefix = useId();
  const cellId = (row: number, col: number) => `${idPrefix}r${row}c${col}`;
  const tabStop = selectedCell ?? { row: 0, col: 0 };

  const selectedRow = selectedCell?.row;
  const selectedCol = selectedCell?.col;
  useEffect(() => {
    if (selectedRow === undefined || selectedCol === undefined) return;
    if (!gridRef.current?.contains(document.activeElement)) return;
    const target = document.getElementById(
      `${idPrefix}r${selectedRow}c${selectedCol}`,
    );
    if (target && target !== document.activeElement) {
      target.focus({ preventScroll: true });
    }
  }, [gridRef, selectedRow, selectedCol, idPrefix]);

  return { cellId, tabStop };
}
