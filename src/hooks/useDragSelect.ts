import { type PointerEvent, useCallback, useRef } from "react";
import { cellKey } from "../lib/sudoku.ts";
import type { Board as BoardType, Position } from "../lib/types.ts";

// Hold a filled cell this long before the press converts to a digit
// drag instead of a select. Picked to feel deliberate without making
// quick "select this cell to write into it" taps feel laggy.
const CELL_DRAG_HOLD_MS = 200;
// Pointer must travel this far between pointerdown and the hold-timer
// firing to qualify as the user starting a drag (rather than a finger
// twitch). After the timer fires, ANY pointer move within the cell is
// treated as drag intent.
const CELL_DRAG_THRESHOLD_PX = 12;

type Options = {
  board: BoardType;
  selectedCell: Position | null;
  selectedCells: Set<number> | undefined;
  onSetSelectedCells:
    | ((cells: Set<number>, primary: Position) => void)
    | undefined;
  /**
   * Fires when a long-press on a filled cell crosses the drag threshold,
   * handing the gesture to the parent's digit-drag layer. The hook also
   * disables its own multi-select for the remainder of this press.
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
  holdTimer: ReturnType<typeof setTimeout> | null;
  holdReady: boolean;
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

  const clearHoldTimer = useCallback(() => {
    if (dragRef.current?.holdTimer) {
      clearTimeout(dragRef.current.holdTimer);
      dragRef.current.holdTimer = null;
    }
  }, []);

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
          holdTimer: null,
          holdReady: false,
          cellDragStarted: false,
        };
        return;
      }

      // For filled cells, arm a hold timer that flips a flag — actual
      // drag-start waits for a small additional move so quick taps still
      // behave as "select this cell" without lifting and re-tapping.
      const holdTimer =
        source && onStartCellDrag
          ? setTimeout(() => {
              const d = dragRef.current;
              if (d) d.holdReady = true;
            }, CELL_DRAG_HOLD_MS)
          : null;

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
        holdTimer,
        holdReady: false,
        cellDragStarted: false,
      };
    },
    [
      onSetSelectedCells,
      selectedCells,
      selectedCell,
      isEmptyCell,
      board,
      onStartCellDrag,
    ],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || !onSetSelectedCells) return;
      if (drag.cellDragStarted) return; // handed off to digit-drag layer

      // Filled-cell drag handover: once the hold timer has armed AND the
      // pointer moves beyond the threshold, transfer control to the
      // parent's digit-drag layer.
      if (
        drag.source &&
        drag.holdReady &&
        onStartCellDrag &&
        e.pointerId === drag.pointerId
      ) {
        const dx = e.clientX - drag.originX;
        const dy = e.clientY - drag.originY;
        if (
          dx * dx + dy * dy >=
          CELL_DRAG_THRESHOLD_PX * CELL_DRAG_THRESHOLD_PX
        ) {
          drag.cellDragStarted = true;
          clearHoldTimer();
          // The source cell was "selected" on pointerdown via React's
          // click handler — but we don't want the drag to leave a stale
          // selection on commit. Mark suppressClick so the trailing
          // click doesn't fire.
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
      if (key !== drag.startKey) {
        drag.moved = true;
        // Moving off the source cell while the hold hasn't armed cancels
        // the hold: the user is multi-selecting, not dragging.
        if (!drag.holdReady) clearHoldTimer();
      }
      if (!isEmptyCell(pos)) return;
      if (!drag.cells.has(key)) {
        drag.cells = new Set(drag.cells);
        drag.cells.add(key);
        if (drag.primaryPos === null) drag.primaryPos = pos;
        onSetSelectedCells(drag.cells, drag.primaryPos);
      }
    },
    [onSetSelectedCells, isEmptyCell, onStartCellDrag, clearHoldTimer],
  );

  const onPointerUp = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    clearHoldTimer();
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
  }, [onSetSelectedCells, clearHoldTimer]);

  const onClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      e.stopPropagation();
      e.preventDefault();
      suppressClickRef.current = false;
    }
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onClickCapture };
}
