import type React from "react";
import { type PointerEvent, useCallback, useRef } from "react";
import { cellKey } from "../lib/sudoku.ts";
import type { Position } from "../lib/types.ts";

type DragState = {
  startKey: number;
  startPos: Position;
  cells: Set<number>;
  moved: boolean;
  shiftClick: boolean;
};

/**
 * Manages pointer-drag multi-cell selection on the board grid.
 * Returns pointer/click handlers and a getCellFromPoint utility.
 */
export function useDragSelection(
  selectedCell: Position | null,
  selectedCells: Set<number> | undefined,
  onSetSelectedCells:
    | ((cells: Set<number>, primary: Position) => void)
    | undefined,
) {
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  const getCellFromPoint = useCallback(
    (x: number, y: number): Position | null => {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const btn = el.closest("[data-row]") as HTMLElement | null;
      if (!btn) return null;
      const row = Number(btn.dataset.row);
      const col = Number(btn.dataset.col);
      if (Number.isNaN(row) || Number.isNaN(col)) return null;
      return { row, col };
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!onSetSelectedCells) return;
      const pos = getCellFromPoint(e.clientX, e.clientY);
      if (!pos) return;
      const key = cellKey(pos.row, pos.col);

      if (e.shiftKey && selectedCells && selectedCells.size > 0) {
        const newCells = new Set(selectedCells);
        newCells.add(key);
        const primary = selectedCell ?? pos;
        onSetSelectedCells(newCells, primary);
        dragRef.current = {
          startKey: key,
          startPos: pos,
          cells: newCells,
          moved: false,
          shiftClick: true,
        };
        return;
      }

      dragRef.current = {
        startKey: key,
        startPos: pos,
        cells: new Set([key]),
        moved: false,
        shiftClick: false,
      };
    },
    [onSetSelectedCells, getCellFromPoint, selectedCells, selectedCell],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || !onSetSelectedCells) return;
      const pos = getCellFromPoint(e.clientX, e.clientY);
      if (!pos) return;
      const key = cellKey(pos.row, pos.col);
      if (key !== drag.startKey) {
        drag.moved = true;
      }
      if (!drag.cells.has(key)) {
        drag.cells = new Set(drag.cells);
        drag.cells.add(key);
        onSetSelectedCells(drag.cells, drag.startPos);
      }
    },
    [onSetSelectedCells, getCellFromPoint],
  );

  const handlePointerUp = useCallback(
    (_e: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.shiftClick || (drag.moved && drag.cells.size > 1)) {
        suppressClickRef.current = true;
        if (drag.moved && drag.cells.size > 1 && onSetSelectedCells) {
          onSetSelectedCells(drag.cells, drag.startPos);
        }
      }
      dragRef.current = null;
    },
    [onSetSelectedCells],
  );

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      e.stopPropagation();
      e.preventDefault();
      suppressClickRef.current = false;
    }
  }, []);

  const enabled = !!onSetSelectedCells;

  return {
    onPointerDown: enabled ? handlePointerDown : undefined,
    onPointerMove: enabled ? handlePointerMove : undefined,
    onPointerUp: enabled ? handlePointerUp : undefined,
    onClickCapture: enabled ? handleClick : undefined,
  };
}
