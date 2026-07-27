import { useEffect, useRef } from "react";
import {
  BOX_GAP_PX,
  FRAME_PX,
  THIN_GAP_PX,
  useBoardGeometry,
} from "../hooks/useBoardGeometry.ts";
import type { DigitDragState } from "../hooks/useDigitDrag.ts";
import { useDragSelect } from "../hooks/useDragSelect.ts";
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
  /**
   * When set and no cell is selected, drives same-number highlighting
   * as if a cell containing this digit were selected. Lets the numpad
   * act as a "filter chip" — tap a digit to spotlight every cell that
   * holds it. Ignored while a cell is selected so the selection's own
   * value takes precedence.
   */
  highlightedDigit?: number | null | undefined;
  onSelectCell: (row: number, col: number) => void;
  onSetSelectedCells?:
    | ((cells: Set<number>, primary: Position) => void)
    | undefined;
  animateReveal?: boolean;
  assistLevel?: AssistLevel;
  /**
   * The digit currently being long-pressed on the numpad — forwarded to
   * the selected cell so the in-cell hold animation can play there.
   */
  chargingDigit?: number | null | undefined;
  /**
   * Optional digit-drag state. When non-null, cells render drop hints
   * — empty cells pulse softly as candidates, the hovered target gets
   * a stronger accent ring, and the source cell (if any) fades.
   */
  dragState?: DigitDragState | null | undefined;
  /**
   * Fires when a long-press on a filled cell becomes a digit drag.
   * The Board passes this through to its useDragSelect hook.
   */
  onStartCellDrag?:
    | ((args: {
        digit: number;
        from: Position;
        x: number;
        y: number;
        pointerId: number;
        pointerType: string;
      }) => void)
    | undefined;
};

export function Board({
  board,
  selectedCell,
  selectedCells,
  conflicts,
  hintCells,
  highlightedDigit,
  onSelectCell,
  onSetSelectedCells,
  animateReveal,
  assistLevel = "standard",
  chargingDigit,
  dragState,
  onStartCellDrag,
}: BoardProps) {
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

  // Drives the selection-glow pulse. Scoped to the board so the animation
  // only runs when a cell is actually selected.
  const hasSelection = selectedCell !== null || (selectedCells?.size ?? 0) > 0;

  // Roving tab index: the grid is one tab stop, not eighty-one. Without
  // this, Tab from the header ran through every cell before reaching the
  // number pad. The stop sits on the selected cell so returning to the
  // board lands where the player left off.
  const tabStop = selectedCell ?? { row: 0, col: 0 };

  const dragHandlers = useDragSelect({
    board,
    selectedCell,
    selectedCells,
    onSetSelectedCells,
    onStartCellDrag,
    onSelectCell,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const { cellPx, boxPx, boardPx } = useBoardGeometry(containerRef);

  // Arrow keys move the selection through a reducer, so DOM focus has to
  // be brought along or the focus ring is left behind on the cell the
  // player started from and assistive tech is told nothing moved. Only
  // when the board already holds focus — otherwise selecting a cell with
  // the mouse, or restoring a saved game, would yank focus to the board.
  const gridRef = useRef<HTMLDivElement>(null);
  const selectedKey = selectedCell
    ? cellKey(selectedCell.row, selectedCell.col)
    : null;
  useEffect(() => {
    const root = gridRef.current;
    if (selectedKey === null || !root) return;
    if (!root.contains(document.activeElement)) return;
    root
      .querySelector<HTMLElement>(
        `[data-row="${Math.floor(selectedKey / 9)}"][data-col="${selectedKey % 9}"]`,
      )
      ?.focus();
  }, [selectedKey]);

  // Block iOS Safari's swipe-from-edge back gesture for drags that
  // originate inside the board. touch-action: none on the cell isn't
  // reliable at the screen edge — Safari often ignores it for the
  // system back-swipe. A non-passive touchstart preventDefault is the
  // only block that works across iOS versions. React's onTouchStart is
  // passive (preventDefault is a no-op), so we attach it natively.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const handler = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("touchstart", handler, { passive: false });
    return () => el.removeEventListener("touchstart", handler);
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full aspect-square flex items-center justify-center"
    >
      <div
        ref={gridRef}
        style={{
          width: boardPx,
          height: boardPx,
          gap: BOX_GAP_PX,
          padding: FRAME_PX,
          gridTemplateColumns: `repeat(3, ${boxPx}px)`,
          gridTemplateRows: `repeat(3, ${boxPx}px)`,
          boxShadow: "var(--elevation-3)",
        }}
        className={`grid bg-board-border rounded-panel overflow-hidden touch-none ${
          hasSelection ? "cell-glow-sync" : ""
        }`}
        role="region"
        aria-label="Sudoku board"
        onPointerDown={
          onSetSelectedCells ? dragHandlers.onPointerDown : undefined
        }
        onPointerMove={
          onSetSelectedCells ? dragHandlers.onPointerMove : undefined
        }
        onPointerUp={onSetSelectedCells ? dragHandlers.onPointerUp : undefined}
        onClickCapture={
          onSetSelectedCells ? dragHandlers.onClickCapture : undefined
        }
      >
        {Array.from({ length: 9 }, (_, boxIdx) => {
          const boxRow = Math.floor(boxIdx / 3);
          const boxCol = boxIdx % 3;
          return (
            <div
              key={boxIdx}
              style={{
                gap: THIN_GAP_PX,
                gridTemplateColumns: `repeat(3, ${cellPx}px)`,
                gridTemplateRows: `repeat(3, ${cellPx}px)`,
              }}
              className="grid bg-border-default"
            >
              {Array.from({ length: 9 }, (_, cellIdx) => {
                const rowIdx = boxRow * 3 + Math.floor(cellIdx / 3);
                const colIdx = boxCol * 3 + (cellIdx % 3);
                const cell = board[rowIdx]![colIdx]!;
                const isSelected =
                  selectedCell?.row === rowIdx && selectedCell?.col === colIdx;
                const isHighlighted =
                  !isPaper &&
                  selectedCell !== null &&
                  (selectedCell.row === rowIdx ||
                    selectedCell.col === colIdx ||
                    (Math.floor(selectedCell.row / 3) ===
                      Math.floor(rowIdx / 3) &&
                      Math.floor(selectedCell.col / 3) ===
                        Math.floor(colIdx / 3)));
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
                  !isSelected &&
                  (hintCells?.has(cellKey(rowIdx, colIdx)) ?? false);
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
                  dragState?.target?.row === rowIdx &&
                  dragState?.target?.col === colIdx;
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
                    chargingDigit={
                      isSelected && chargingDigit != null
                        ? chargingDigit
                        : undefined
                    }
                    tabIndex={
                      rowIdx === tabStop.row && colIdx === tabStop.col ? 0 : -1
                    }
                    isDragSource={isDragSource}
                    dropTargetState={dropTargetState}
                    dropMode={dropMode}
                    dropDigit={dropDigit}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
