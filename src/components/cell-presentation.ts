import type { DigitDragState } from "../hooks/useDigitDrag.ts";
import { cellKey } from "../lib/sudoku.ts";
import type { AssistLevel, Board, Position } from "../lib/types.ts";

/** Rows, columns and boxes holding `value`, minus the selected cell. */
export type ExclusionBands = {
  rows: Set<number>;
  cols: Set<number>;
  boxes: Set<number>;
};

/**
 * Where the digit in play already sits, so the grid can shade every unit
 * it cannot go in. The cell holding it is left out: its own unit is
 * already lit by the selection.
 */
export function exclusionBands(
  board: Board,
  value: number,
  selectedCell: Position | null,
): ExclusionBands | null {
  const rows = new Set<number>();
  const cols = new Set<number>();
  const boxes = new Set<number>();
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (
        board[r]![c]!.value === value &&
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
}

/** Everything one cell of the painted grid needs to know about itself. */
export type CellPresentation = {
  isSelected: boolean;
  isMultiSelected: boolean;
  isHighlighted: boolean;
  isSameNumber: boolean;
  isConflict: boolean;
  isHintRelated: boolean;
  isSameNumberRowCol: boolean;
  isDragSource: boolean;
  dropTargetState: "valid" | "invalid" | null;
  dropMode: "value" | "note" | undefined;
  dropDigit: number | undefined;
  /** Stagger offset for the reveal wave, or undefined for a blank cell. */
  revealDelay: number | undefined;
};

export type CellPresentationInput = {
  board: Board;
  row: number;
  col: number;
  selectedCell: Position | null;
  selectedCells?: Set<number> | undefined;
  conflicts: Set<number>;
  hintCells?: Set<number> | undefined;
  /** Value in play: the selected cell's, or the numpad chip's. */
  activeValue: number | null;
  bands: ExclusionBands | null;
  assistLevel: AssistLevel;
  animateReveal?: boolean | undefined;
  dragState?: DigitDragState | null | undefined;
};

/**
 * Decides what one cell looks like, from the board and the interaction
 * state around it. The WebGL scene derives the same facts from the same
 * inputs in `three/scene-state.ts`, so the painted grid and the scene
 * stay a twin apart rather than two interpretations of one board.
 */
export function cellPresentation(
  input: CellPresentationInput,
): CellPresentation {
  const {
    board,
    row,
    col,
    selectedCell,
    selectedCells,
    conflicts,
    hintCells,
    activeValue,
    bands,
    assistLevel,
    animateReveal,
    dragState,
  } = input;
  const isPaper = assistLevel === "paper";
  const cell = board[row]![col]!;
  const key = cellKey(row, col);
  const isSelected = selectedCell?.row === row && selectedCell?.col === col;
  const isMultiSelected =
    !isSelected &&
    (selectedCells?.size ?? 0) > 1 &&
    (selectedCells?.has(key) ?? false);
  const isSameNumber =
    !isPaper &&
    !isSelected &&
    activeValue !== null &&
    cell.value !== null &&
    cell.value === activeValue;

  return {
    isSelected,
    isMultiSelected,
    isHighlighted:
      !isPaper &&
      selectedCell !== null &&
      (selectedCell.row === row ||
        selectedCell.col === col ||
        (Math.floor(selectedCell.row / 3) === Math.floor(row / 3) &&
          Math.floor(selectedCell.col / 3) === Math.floor(col / 3))),
    isSameNumber,
    isConflict: conflicts.has(key),
    isHintRelated: !isSelected && (hintCells?.has(key) ?? false),
    isSameNumberRowCol:
      bands !== null &&
      !isSelected &&
      !isSameNumber &&
      (bands.rows.has(row) ||
        bands.cols.has(col) ||
        bands.boxes.has(Math.floor(row / 3) * 3 + Math.floor(col / 3))),
    isDragSource:
      dragState?.source.kind === "cell" &&
      dragState.source.row === row &&
      dragState.source.col === col,
    dropTargetState:
      dragState?.target?.row === row && dragState.target?.col === col
        ? dragState.invalidTarget
          ? "invalid"
          : "valid"
        : null,
    dropMode:
      dragState?.target?.row === row &&
      dragState.target?.col === col &&
      !dragState.invalidTarget
        ? dragState.mode
        : undefined,
    dropDigit:
      dragState?.target?.row === row &&
      dragState.target?.col === col &&
      !dragState.invalidTarget
        ? dragState.digit
        : undefined,
    revealDelay:
      animateReveal && cell.isGiven ? (row * 9 + col) * 6 : undefined,
  };
}
