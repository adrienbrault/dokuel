import { cellKey } from "../lib/sudoku.ts";
import type { Board as BoardType, Position } from "../lib/types.ts";
import { Cell } from "./Cell.tsx";
import { useSketch } from "./SketchContext.tsx";
import { SketchOverlay } from "./SketchOverlay.tsx";

type BoardProps = {
  board: BoardType;
  selectedCell: Position | null;
  conflicts: Set<number>;
  onSelectCell: (row: number, col: number) => void;
  animateReveal?: boolean;
};

export function Board({
  board,
  selectedCell,
  conflicts,
  onSelectCell,
  animateReveal,
}: BoardProps) {
  const sketch = useSketch();
  const selectedValue =
    selectedCell !== null
      ? board[selectedCell.row]![selectedCell.col]!.value
      : null;

  return (
    <div
      className={`relative grid grid-cols-9 w-full max-w-lg aspect-square ${
        sketch
          ? ""
          : "border-2 border-board-border rounded-md overflow-hidden shadow-lg shadow-black/8 dark:shadow-black/25"
      }`}
      role="region"
      aria-label="Sudoku board"
    >
      {sketch && <SketchOverlay />}
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

          return (
            <Cell
              key={cellKey(rowIdx, colIdx)}
              cell={cell}
              row={rowIdx}
              col={colIdx}
              isSelected={isSelected}
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
