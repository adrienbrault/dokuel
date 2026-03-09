import type React from "react";
import { type PointerEvent, useCallback, useRef } from "react";
import { cellKey } from "../lib/sudoku.ts";
import type { Position } from "../lib/types.ts";

type UseDragSelectionOptions = {
  onSetSelectedCells: (cells: Set<number>, primary: Position) => void;
  selectedCells: Set<number> | undefined;
  selectedCell: Position | null;
};

type UseDragSelectionResult = {
  handlePointerDown: (e: PointerEvent<HTMLDivElement>) => void;
  handlePointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  handlePointerUp: (e: PointerEvent<HTMLDivElement>) => void;
  handleClick: (e: React.MouseEvent<HTMLDivElement>) => void;
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

export function useDragSelection({
  onSetSelectedCells,
  selectedCells,
  selectedCell,
}: UseDragSelectionOptions): UseDragSelectionResult {
  const dragRef = useRef<{
    startKey: number;
    startPos: Position;
    cells: Set<number>;
    moved: boolean;
    shiftClick: boolean;
  } | null>(null);

  const suppressClickRef = useRef(false);

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
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

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
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
    [onSetSelectedCells],
  );

  const handlePointerUp = useCallback(
    (_e: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      // Shift+click or drag: suppress the subsequent Cell onClick
      if (drag.shiftClick || (drag.moved && drag.cells.size > 1)) {
        suppressClickRef.current = true;
        if (drag.moved && drag.cells.size > 1) {
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

  return { handlePointerDown, handlePointerMove, handlePointerUp, handleClick };
}
