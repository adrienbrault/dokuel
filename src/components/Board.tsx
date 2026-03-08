import type React from "react";
import { type PointerEvent, useCallback, useRef } from "react";
import { cellKey } from "../lib/sudoku.ts";
import type {
  AssistLevel,
  Board as BoardType,
  Position,
} from "../lib/types.ts";
import { Cell } from "./Cell.tsx";

type BoardProps = {
  board: BoardType;
  selectedCell: Position | null;
  selectedCells?: Set<number> | undefined;
  conflicts: Set<number>;
  hintCells?: Set<number> | undefined;
  onSelectCell: (row: number, col: number) => void;
  onSetSelectedCells?:
    | ((cells: Set<number>, primary: Position) => void)
    | undefined;
  animateReveal?: boolean;
  assistLevel?: AssistLevel;
};

export function Board({
  board,
  selectedCell,
  selectedCells,
  conflicts,
  hintCells,
  onSelectCell,
  onSetSelectedCells,
  animateReveal,
  assistLevel = "standard",
}: BoardProps) {
  const isPaper = assistLevel === "paper";
  const isFull = assistLevel === "full";
  const selectedValue =
    selectedCell !== null
      ? board[selectedCell.row]![selectedCell.col]!.value
      : null;

  // In full assist mode, collect rows/cols of all cells matching selected value
  // (excluding the selected cell itself) for cross-highlight
  const matchRowColSet = (() => {
    if (!isFull || selectedValue === null) return null;
    const rows = new Set<number>();
    const cols = new Set<number>();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (
          board[r]![c]!.value === selectedValue &&
          !(selectedCell!.row === r && selectedCell!.col === c)
        ) {
          rows.add(r);
          cols.add(c);
        }
      }
    }
    return rows.size > 0 || cols.size > 0 ? { rows, cols } : null;
  })();

  const dragRef = useRef<{
    startKey: number;
    startPos: Position;
    cells: Set<number>;
    moved: boolean;
    shiftClick: boolean;
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

  // Suppress Cell onClick after Shift+click to avoid resetting multi-selection
  const suppressClickRef = useRef(false);
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      e.stopPropagation();
      e.preventDefault();
      suppressClickRef.current = false;
    }
  }, []);

  const handlePointerUp = useCallback(
    (_e: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      // Shift+click or drag: suppress the subsequent Cell onClick
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

  return (
    <div
      className="grid grid-cols-9 border-2 border-board-border rounded-md overflow-hidden w-full max-w-lg aspect-square shadow-lg shadow-black/8 dark:shadow-black/25 touch-none"
      role="region"
      aria-label="Sudoku board"
      onPointerDown={onSetSelectedCells ? handlePointerDown : undefined}
      onPointerMove={onSetSelectedCells ? handlePointerMove : undefined}
      onPointerUp={onSetSelectedCells ? handlePointerUp : undefined}
      onClickCapture={onSetSelectedCells ? handleClick : undefined}
    >
      {board.flatMap((row, rowIdx) =>
        row.map((cell, colIdx) => {
          const isSelected =
            selectedCell?.row === rowIdx && selectedCell?.col === colIdx;
          const isHighlighted =
            !isPaper &&
            selectedCell !== null &&
            (selectedCell.row === rowIdx ||
              selectedCell.col === colIdx ||
              (Math.floor(selectedCell.row / 3) === Math.floor(rowIdx / 3) &&
                Math.floor(selectedCell.col / 3) === Math.floor(colIdx / 3)));
          const isSameNumber =
            !isPaper &&
            !isSelected &&
            selectedValue !== null &&
            cell.value !== null &&
            cell.value === selectedValue;
          const isConflict = conflicts.has(cellKey(rowIdx, colIdx));
          const isMultiSelected =
            !isSelected &&
            (selectedCells?.size ?? 0) > 1 &&
            (selectedCells?.has(cellKey(rowIdx, colIdx)) ?? false);
          const isHintRelated =
            !isSelected && (hintCells?.has(cellKey(rowIdx, colIdx)) ?? false);
          const isSameNumberRowCol =
            matchRowColSet !== null &&
            !isSelected &&
            !isSameNumber &&
            (matchRowColSet.rows.has(rowIdx) ||
              matchRowColSet.cols.has(colIdx));

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
              isHintRelated={isHintRelated}
              isSameNumberRowCol={isSameNumberRowCol}
              assistLevel={assistLevel}
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
