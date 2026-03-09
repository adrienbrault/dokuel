import { useMemo } from "react";
import { useDragSelection } from "../hooks/useDragSelection.ts";
import { GRID_SIZE } from "../lib/constants.ts";
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
  conflicts: ReadonlySet<number>;
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

  const matchRowColSet = useMemo(() => {
    if (!isFull || selectedValue === null) return null;
    const rows = new Set<number>();
    const cols = new Set<number>();
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
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
  }, [board, selectedValue, isFull, selectedCell]);

  const dragHandlers = useDragSelection(
    selectedCell,
    selectedCells,
    onSetSelectedCells,
  );

  return (
    <div
      className="grid grid-cols-9 border-2 border-board-border rounded-md overflow-hidden w-full max-w-lg aspect-square shadow-lg shadow-black/8 dark:shadow-black/25 touch-none"
      role="region"
      aria-label="Sudoku board"
      {...dragHandlers}
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
                  ? (rowIdx * GRID_SIZE + colIdx) * 6
                  : undefined
              }
            />
          );
        }),
      )}
    </div>
  );
}
