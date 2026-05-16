import { type PointerEvent, useCallback, useRef } from "react";
import { cellKey } from "../lib/sudoku.ts";
import type { Position } from "../lib/types.ts";

type Options = {
  selectedCell: Position | null;
  selectedCells: Set<number> | undefined;
  onSetSelectedCells:
    | ((cells: Set<number>, primary: Position) => void)
    | undefined;
};

type DragState = {
  startKey: number;
  startPos: Position;
  cells: Set<number>;
  moved: boolean;
  shiftClick: boolean;
};

function getCellFromPoint(
  x: number,
  y: number,
): { row: number; col: number } | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const btn = el.closest("[data-row]") as HTMLElement | null;
  if (!btn) return null;
  const row = Number(btn.dataset.row);
  const col = Number(btn.dataset.col);
  if (Number.isNaN(row) || Number.isNaN(col)) return null;
  return { row, col };
}

export function useDragSelect({
  selectedCell,
  selectedCells,
  onSetSelectedCells,
}: Options) {
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!onSetSelectedCells) return;
      const pos = getCellFromPoint(e.clientX, e.clientY);
      if (!pos) return;
      const key = cellKey(pos.row, pos.col);

      // Shift+click: add to existing selection
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
    [onSetSelectedCells, selectedCells, selectedCell],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || !onSetSelectedCells) return;
      const pos = getCellFromPoint(e.clientX, e.clientY);
      if (!pos) return;
      const key = cellKey(pos.row, pos.col);
      if (key !== drag.startKey) drag.moved = true;
      if (!drag.cells.has(key)) {
        drag.cells = new Set(drag.cells);
        drag.cells.add(key);
        onSetSelectedCells(drag.cells, drag.startPos);
      }
    },
    [onSetSelectedCells],
  );

  const onPointerUp = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.shiftClick || (drag.moved && drag.cells.size > 1)) {
      suppressClickRef.current = true;
      if (drag.moved && drag.cells.size > 1 && onSetSelectedCells) {
        onSetSelectedCells(drag.cells, drag.startPos);
      }
    }
    dragRef.current = null;
  }, [onSetSelectedCells]);

  const onClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      e.stopPropagation();
      e.preventDefault();
      suppressClickRef.current = false;
    }
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onClickCapture };
}
