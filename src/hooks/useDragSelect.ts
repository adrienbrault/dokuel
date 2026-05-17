import { type PointerEvent, useCallback, useRef } from "react";
import { cellKey } from "../lib/sudoku.ts";
import type { Board as BoardType, Position } from "../lib/types.ts";

// Pointer must travel this far from the press origin before a press on
// a filled cell converts into a digit drag. Small enough to feel
// instant, large enough to not steal taps from finger twitches.
const CELL_DRAG_THRESHOLD_PX = 6;

type Options = {
  board: BoardType;
  selectedCell: Position | null;
  selectedCells: Set<number> | undefined;
  onSetSelectedCells:
    | ((cells: Set<number>, primary: Position) => void)
    | undefined;
  /**
   * Fires the moment a press on a filled cell crosses the drag
   * threshold, handing the gesture to the parent's digit-drag layer.
   * The hook also disables its own multi-select for the remainder of
   * this press.
   */
  onStartCellDrag?:
    | ((args: {
        digit: number;
        from: Position;
        x: number;
        y: number;
        pointerId: number;
      }) => void)
    | undefined;
};

type DragState = {
  startKey: number;
  primaryPos: Position | null;
  cells: Set<number>;
  moved: boolean;
  shiftClick: boolean;
  // Press tracking for filled-cell drag
  originX: number;
  originY: number;
  pointerId: number;
  source: { row: number; col: number; value: number } | null;
  cellDragStarted: boolean;
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
  board,
  selectedCell,
  selectedCells,
  onSetSelectedCells,
  onStartCellDrag,
}: Options) {
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  const isEmptyCell = useCallback(
    (pos: Position) => board[pos.row]![pos.col]!.value === null,
    [board],
  );

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!onSetSelectedCells) return;
      const pos = getCellFromPoint(e.clientX, e.clientY);
      if (!pos) return;
      const key = cellKey(pos.row, pos.col);
      const empty = isEmptyCell(pos);
      const cellValue = board[pos.row]![pos.col]!.value;
      const source =
        !empty && cellValue !== null
          ? { row: pos.row, col: pos.col, value: cellValue }
          : null;

      // Shift+click: add to existing selection (only empty cells)
      if (e.shiftKey && selectedCells && selectedCells.size > 0) {
        if (!empty) return;
        const newCells = new Set(selectedCells);
        newCells.add(key);
        const primary = selectedCell ?? pos;
        onSetSelectedCells(newCells, primary);
        dragRef.current = {
          startKey: key,
          primaryPos: pos,
          cells: newCells,
          moved: false,
          shiftClick: true,
          originX: e.clientX,
          originY: e.clientY,
          pointerId: e.pointerId,
          source: null,
          cellDragStarted: false,
        };
        return;
      }

      dragRef.current = {
        startKey: key,
        primaryPos: empty ? pos : null,
        cells: empty ? new Set([key]) : new Set(),
        moved: false,
        shiftClick: false,
        originX: e.clientX,
        originY: e.clientY,
        pointerId: e.pointerId,
        source,
        cellDragStarted: false,
      };
    },
    [onSetSelectedCells, selectedCells, selectedCell, isEmptyCell, board],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || !onSetSelectedCells) return;
      if (drag.cellDragStarted) return; // handed off to digit-drag layer

      // Filled-cell drag handover: any movement beyond the small slop
      // threshold converts the press into a digit drag. A pure tap (no
      // movement) still falls through to the click handler that selects
      // the cell.
      if (drag.source && onStartCellDrag && e.pointerId === drag.pointerId) {
        const dx = e.clientX - drag.originX;
        const dy = e.clientY - drag.originY;
        if (
          dx * dx + dy * dy >=
          CELL_DRAG_THRESHOLD_PX * CELL_DRAG_THRESHOLD_PX
        ) {
          drag.cellDragStarted = true;
          // Suppress the trailing click so the drag doesn't also leave
          // a stale selection on the source cell.
          suppressClickRef.current = true;
          onStartCellDrag({
            digit: drag.source.value,
            from: { row: drag.source.row, col: drag.source.col },
            x: e.clientX,
            y: e.clientY,
            pointerId: e.pointerId,
          });
          return;
        }
      }

      const pos = getCellFromPoint(e.clientX, e.clientY);
      if (!pos) return;
      const key = cellKey(pos.row, pos.col);
      if (key !== drag.startKey) drag.moved = true;
      if (!isEmptyCell(pos)) return;
      if (!drag.cells.has(key)) {
        drag.cells = new Set(drag.cells);
        drag.cells.add(key);
        if (drag.primaryPos === null) drag.primaryPos = pos;
        onSetSelectedCells(drag.cells, drag.primaryPos);
      }
    },
    [onSetSelectedCells, isEmptyCell, onStartCellDrag],
  );

  const onPointerUp = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.cellDragStarted) {
      // The digit-drag layer owns the rest of this gesture.
      dragRef.current = null;
      return;
    }
    if (drag.shiftClick || (drag.moved && drag.cells.size > 1)) {
      suppressClickRef.current = true;
      if (
        drag.moved &&
        drag.cells.size > 1 &&
        drag.primaryPos &&
        onSetSelectedCells
      ) {
        onSetSelectedCells(drag.cells, drag.primaryPos);
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
