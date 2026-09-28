import type { DigitDragState } from "../hooks/useDigitDrag.ts";
import { cellKey } from "../lib/sudoku.ts";
import type {
  AssistLevel,
  Board,
  DigitColorMode,
  Position,
} from "../lib/types.ts";

/**
 * The one background treatment a tile wears, in the same precedence
 * order the DOM cell uses: selection wins, then conflict, then hint,
 * then same-number, then peer highlight, then exclusion band.
 */
export type CellVisualState =
  | "idle"
  | "highlight"
  | "matchRowCol"
  | "same"
  | "hint"
  | "conflict"
  | "selected";

/** The ink treatment for a glyph. Conflicts keep their own channel. */
export type InkState = "given" | "user" | "conflict";

/**
 * Everything the WebGL scene needs to draw one cell, derived from the
 * same props the DOM grid consumes. Kept free of React and Three so it
 * can be unit-tested and reused if the renderer is ever swapped.
 */
export type CellVisual = {
  row: number;
  col: number;
  state: CellVisualState;
  ink: InkState;
  value: number | null;
  isGiven: boolean;
  notes: number[];
  /** Emoji symbol for the cell's value, or null when there is none. */
  emoji: string | null;
  hover: boolean;
  charging: boolean;
  dragSource: boolean;
  dropTarget: "valid" | "invalid" | null;
  dropMode: "value" | "note";
  dropDigit: number | null;
  /** Stagger offset in ms for the given-reveal wave; null for blanks. */
  revealDelayMs: number | null;
};

export type SceneSnapshot = {
  cells: CellVisual[];
  digitMode: DigitColorMode;
  /** True once the puzzle is solved — drives the one-shot celebration. */
  completed: boolean;
  reducedMotion: boolean;
};

export type SceneSnapshotInput = {
  board: Board;
  selectedCell: Position | null;
  selectedCells?: Set<number> | undefined;
  conflicts: Set<number>;
  hintCells?: Set<number> | undefined;
  highlightedDigit?: number | null | undefined;
  assistLevel: AssistLevel;
  animateReveal?: boolean | undefined;
  chargingDigit?: number | null | undefined;
  dragState?: DigitDragState | null | undefined;
  completed?: boolean | undefined;
  /** Cell key under the pointer, resolved by the 3D hit test. */
  hover: number | null;
  digitMode: DigitColorMode;
  /** Nine symbols indexed by digit - 1, for emoji mode. */
  emoji: string[];
  reducedMotion: boolean;
};

/** Rows, columns and boxes holding `value`, minus the selected cell. */
function exclusionBands(
  board: Board,
  value: number,
  selectedCell: Position | null,
) {
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
  return { rows, cols, boxes };
}

function sortedNotes(notes: Set<number>): number[] {
  return [...notes].sort((a, b) => a - b);
}

/**
 * Turns the board plus its interaction state into 81 flat cell visuals.
 * Pure so the visual rules of the 3D board are testable without WebGL.
 */
export function deriveCellVisuals(input: SceneSnapshotInput): CellVisual[] {
  const {
    board,
    selectedCell,
    selectedCells,
    conflicts,
    hintCells,
    highlightedDigit,
    assistLevel,
    animateReveal,
    chargingDigit,
    dragState,
    hover,
    emoji,
    digitMode,
  } = input;

  // Only an emoji mode paints symbols; everywhere else a cell draws its
  // own numeral, so it must not name a glyph the atlas does not hold.
  const symbols = digitMode === "emoji" ? emoji : [];

  const isPaper = assistLevel === "paper";
  const isFull = assistLevel === "full";
  const activeValue =
    selectedCell !== null
      ? board[selectedCell.row]![selectedCell.col]!.value
      : (highlightedDigit ?? null);
  const bands =
    isFull && activeValue !== null
      ? exclusionBands(board, activeValue, selectedCell)
      : null;

  const cells: CellVisual[] = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const key = cellKey(row, col);
      const cell = board[row]![col]!;
      const isSelected =
        selectedCell !== null &&
        selectedCell.row === row &&
        selectedCell.col === col;
      const isMultiSelected =
        !isSelected &&
        (selectedCells?.size ?? 0) > 1 &&
        (selectedCells?.has(key) ?? false);
      const isConflict = conflicts.has(key);
      const isHintRelated = !isSelected && (hintCells?.has(key) ?? false);
      const isSameNumber =
        !isPaper &&
        !isSelected &&
        activeValue !== null &&
        cell.value !== null &&
        cell.value === activeValue;
      const isHighlighted =
        !isPaper &&
        selectedCell !== null &&
        !(isSelected || isMultiSelected) &&
        (selectedCell.row === row ||
          selectedCell.col === col ||
          (Math.floor(selectedCell.row / 3) === Math.floor(row / 3) &&
            Math.floor(selectedCell.col / 3) === Math.floor(col / 3)));
      const isSameNumberRowCol =
        bands !== null &&
        !isSelected &&
        !isSameNumber &&
        (bands.rows.has(row) ||
          bands.cols.has(col) ||
          bands.boxes.has(Math.floor(row / 3) * 3 + Math.floor(col / 3)));

      const state: CellVisualState =
        isSelected || isMultiSelected
          ? isPaper
            ? "idle"
            : "selected"
          : isConflict
            ? "conflict"
            : isHintRelated
              ? "hint"
              : isSameNumber
                ? "same"
                : isHighlighted
                  ? "highlight"
                  : isSameNumberRowCol
                    ? "matchRowCol"
                    : "idle";

      const ink: InkState = cell.isGiven
        ? "given"
        : isConflict
          ? "conflict"
          : "user";

      const isDragSource =
        dragState?.source.kind === "cell" &&
        dragState.source.row === row &&
        dragState.source.col === col;
      const isDropTarget =
        dragState?.target?.row === row && dragState?.target?.col === col;
      const dropTarget =
        isDropTarget && dragState
          ? dragState.invalidTarget
            ? ("invalid" as const)
            : ("valid" as const)
          : null;

      cells.push({
        row,
        col,
        state,
        ink,
        value: cell.value,
        isGiven: cell.isGiven,
        notes: sortedNotes(cell.notes),
        emoji: cell.value !== null ? (symbols[cell.value - 1] ?? null) : null,
        hover: hover === key,
        charging: isSelected && chargingDigit != null && !isPaper,
        dragSource: isDragSource,
        dropTarget,
        dropMode: dragState?.mode ?? "value",
        dropDigit: dropTarget === "valid" ? (dragState?.digit ?? null) : null,
        revealDelayMs:
          animateReveal && cell.isGiven ? (row * 9 + col) * 6 : null,
      });
    }
  }
  return cells;
}

/** Bundles the derived cells with the render-wide flags. */
export function buildSceneSnapshot(input: SceneSnapshotInput): SceneSnapshot {
  return {
    cells: deriveCellVisuals(input),
    digitMode: input.digitMode,
    completed: input.completed ?? false,
    reducedMotion: input.reducedMotion,
  };
}
