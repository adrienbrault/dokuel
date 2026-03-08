import { type PointerEvent, useCallback, useRef } from "react";
import { cellKey } from "../lib/sudoku.ts";
import type { Board as BoardType, Position } from "../lib/types.ts";
import { Cell } from "./Cell.tsx";

type BoardProps = {
  board: BoardType;
  selectedCell: Position | null;
  selectedCells?: Set<number> | undefined;
  conflicts: Set<number>;
  onSelectCell: (row: number, col: number) => void;
  onSetSelectedCells?:
    | ((cells: Set<number>, primary: Position) => void)
    | undefined;
  animateReveal?: boolean;
};

export function Board({
  board,
  selectedCell,
  selectedCells,
  conflicts,
  onSelectCell,
  onSetSelectedCells,
  animateReveal,
}: BoardProps) {
  const selectedValue =
    selectedCell !== null
      ? board[selectedCell.row]![selectedCell.col]!.value
      : null;

  const dragRef = useRef<{
    startKey: number;
    startPos: Position;
    cells: Set<number>;
    moved: boolean;
  } | null>(null);

  const getCellFromPoint = useCallback(
    (x: number, y: number): { row: number; col: number } | null => {
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
      dragRef.current = {
        startKey: key,
        startPos: pos,
        cells: new Set([key]),
        moved: false,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [onSetSelectedCells, getCellFromPoint],
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
    (e: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      // Single tap (no movement) — let Cell's onClick handle selection normally.
      // Only finalize multi-select if the user actually dragged across cells.
      if (drag.moved && drag.cells.size > 1 && onSetSelectedCells) {
        onSetSelectedCells(drag.cells, drag.startPos);
      }
      dragRef.current = null;
    },
    [onSetSelectedCells],
  );

  return (
    <div
      className="grid grid-cols-9 border-2 border-board-border rounded-md overflow-hidden w-full max-w-lg aspect-square shadow-lg shadow-black/8 dark:shadow-black/25"
      role="region"
      aria-label="Sudoku board"
      onPointerDown={onSetSelectedCells ? handlePointerDown : undefined}
      onPointerMove={onSetSelectedCells ? handlePointerMove : undefined}
      onPointerUp={onSetSelectedCells ? handlePointerUp : undefined}
    >
      {board.flatMap((row, rowIdx) =>
        row.map((cell, colIdx) => {
          const isSelected =
            selectedCell?.row === rowIdx && selectedCell?.col === colIdx;
          const isHighlighted =
            selectedCell !== null &&
            (selectedCell.row === rowIdx ||
              selectedCell.col === colIdx ||
              (Math.floor(selectedCell.row / 3) === Math.floor(rowIdx / 3) &&
                Math.floor(selectedCell.col / 3) === Math.floor(colIdx / 3)));
          const isSameNumber =
            !isSelected &&
            selectedValue !== null &&
            cell.value !== null &&
            cell.value === selectedValue;
          const isConflict = conflicts.has(cellKey(rowIdx, colIdx));
          const isMultiSelected =
            !isSelected &&
            (selectedCells?.size ?? 0) > 1 &&
            (selectedCells?.has(cellKey(rowIdx, colIdx)) ?? false);

          return (
            <Cell
              key={cellKey(rowIdx, colIdx)}
              cell={cell}
              row={rowIdx}
              col={colIdx}
              isSelected={isSelected}
              isMultiSelected={isMultiSelected}
              isHighlighted={isHighlighted && !isSelected}
              isSameNumber={isSameNumber}
              isConflict={isConflict}
              onSelect={onSelectCell}
              revealDelay={
                animateReveal && cell.isGiven
                  ? (rowIdx * 9 + colIdx) * 6
                  : undefined
              }
            />
          );
        }),
      )}
    </div>
  );
}
