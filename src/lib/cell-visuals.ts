import { cellKey } from "./sudoku.ts";
import type { AssistLevel, Board, CellVisual, Position } from "./types.ts";

type DragLike = {
  digit: number;
  source: { kind: string; row?: number; col?: number };
  target: Position | null;
  invalidTarget: boolean;
  mode: "value" | "note";
};

type CellVisualsInput = {
  board: Board;
  selectedCell: Position | null;
  selectedCells?: Set<number> | undefined;
  conflicts: Set<number>;
  hintCells?: Set<number> | undefined;
  highlightedDigit?: number | null | undefined;
  assistLevel: AssistLevel;
  dragState?: DragLike | null | undefined;
};

/**
 * The highlight state of all 81 cells, row-major. One derivation feeds
 * every renderer (the DOM grid and the WebGL board) so they can never
 * disagree about what is selected, conflicting or hinted.
 */
export function computeCellVisuals({
  board,
  selectedCell,
  selectedCells,
  conflicts,
  hintCells,
  highlightedDigit,
  assistLevel,
  dragState,
}: CellVisualsInput): CellVisual[] {
  const isPaper = assistLevel === "paper";
  const isFull = assistLevel === "full";
  const selectedValue =
    selectedCell !== null
      ? board[selectedCell.row]![selectedCell.col]!.value
      : (highlightedDigit ?? null);

  // In full assist mode, collect rows/cols/boxes of all cells matching the
  // active value (the selected cell's value, or the numpad-highlighted digit)
  // for the "where this digit can't go" cross-highlight. The selected cell
  // itself is excluded so its own row/col/box don't double-up over the
  // selection halo.
  const matchRowColSet = (() => {
    if (!isFull || selectedValue === null) return null;
    const rows = new Set<number>();
    const cols = new Set<number>();
    const boxes = new Set<number>();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (
          board[r]![c]!.value === selectedValue &&
          !(selectedCell?.row === r && selectedCell?.col === c)
        ) {
          rows.add(r);
          cols.add(c);
          boxes.add(Math.floor(r / 3) * 3 + Math.floor(c / 3));
        }
      }
    }
    return rows.size > 0 || cols.size > 0 || boxes.size > 0
      ? { rows, cols, boxes }
      : null;
  })();

  const visuals: CellVisual[] = [];
  for (let rowIdx = 0; rowIdx < 9; rowIdx++) {
    for (let colIdx = 0; colIdx < 9; colIdx++) {
      const cell = board[rowIdx]![colIdx]!;
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
          matchRowColSet.cols.has(colIdx) ||
          matchRowColSet.boxes.has(
            Math.floor(rowIdx / 3) * 3 + Math.floor(colIdx / 3),
          ));

      // Drag-related render flags
      const isDragSource =
        dragState?.source.kind === "cell" &&
        dragState.source.row === rowIdx &&
        dragState.source.col === colIdx;
      const isDropTarget =
        dragState?.target?.row === rowIdx && dragState?.target?.col === colIdx;
      const dropTargetState =
        isDropTarget && dragState
          ? dragState.invalidTarget
            ? "invalid"
            : "valid"
          : null;
      const dropMode =
        dropTargetState === "valid" ? dragState?.mode : undefined;
      const dropDigit =
        dropTargetState === "valid" ? dragState?.digit : undefined;

      visuals.push({
        isSelected,
        isMultiSelected,
        isHighlighted: isHighlighted && !isSelected,
        isSameNumber,
        isConflict,
        isHintRelated,
        isSameNumberRowCol,
        isDragSource,
        dropTargetState,
        dropMode,
        dropDigit,
      });
    }
  }
  return visuals;
}
