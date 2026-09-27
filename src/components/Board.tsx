import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useBoard3D } from "../hooks/useBoard3D.ts";
import type { DigitDragState } from "../hooks/useDigitDrag.ts";
import { useDragSelect } from "../hooks/useDragSelect.ts";
import { useGridFocus } from "../hooks/useGridFocus.ts";
import { computeCellVisuals } from "../lib/cell-visuals.ts";
import { cellKey } from "../lib/sudoku.ts";
import type {
  AssistLevel,
  Board as BoardType,
  Position,
} from "../lib/types.ts";
import { BoardAnnouncer } from "./BoardAnnouncer.tsx";
import { Cell } from "./Cell.tsx";

const BoardSceneLayer = lazy(() => import("./BoardSceneLayer.tsx"));

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
  /** True once the puzzle is solved; the live region announces it. */
  completed?: boolean | undefined;
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
  completed,
}: BoardProps) {
  const visuals = computeCellVisuals({
    board,
    selectedCell,
    selectedCells,
    conflicts,
    hintCells,
    highlightedDigit,
    assistLevel,
    dragState,
  });

  const dragHandlers = useDragSelect({
    board,
    selectedCell,
    selectedCells,
    onSetSelectedCells,
    onStartCellDrag,
    onSelectCell,
  });

  // Snap the board to an integer-pixel size so every cell and every gap
  // renders at exact device pixels. Sub-pixel cell widths cause adjacent
  // gaps to anti-alias to different widths (some 1px, some 2px); flooring
  // to an integer cell size makes that impossible.
  // Total board = 9 cells + 6 thin gaps (1px) + 2 thick gaps (2px) + 2 outer
  // pads (2px) = 9 * cellPx + 14.
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellPx, setCellPx] = useState(32);
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w === 0) return;
      setCellPx(Math.max(20, Math.floor((w - 14) / 9)));
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const boxPx = cellPx * 3 + 2;
  const boardPx = cellPx * 9 + 14;

  // Block iOS Safari's swipe-from-edge back gesture for drags that
  // originate inside the board. touch-action: none on the cell isn't
  // reliable at the screen edge — Safari often ignores it for the
  // system back-swipe. A non-passive touchstart preventDefault is the
  // only block that works across iOS versions. React's onTouchStart is
  // passive (preventDefault is a no-op), so we attach it natively.
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const handler = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("touchstart", handler, { passive: false });
    return () => el.removeEventListener("touchstart", handler);
  }, []);
  const { cellId, tabStop } = useGridFocus(gridRef, selectedCell);

  // The WebGL board draws under the grid; the grid only goes see-through
  // once a first frame is actually on screen, so a slow chunk or a
  // failed context never leaves the player with a blank board.
  const board3d = useBoard3D();
  const [drawn3d, setDrawn3d] = useState(false);
  // The scene chunk can arrive after the reveal window has closed; it
  // still owes the board the entrance the player would have seen.
  const [revealOnMount] = useState(animateReveal ?? false);
  const show3d = board3d.active && drawn3d;

  return (
    <div
      ref={containerRef}
      className="w-full max-w-none lg:max-w-lg aspect-square flex items-center justify-center"
    >
      <div className="relative isolate">
        {board3d.active && (
          <Suspense fallback={null}>
            <BoardSceneLayer
              gridRef={gridRef}
              cellPx={cellPx}
              state={{
                board,
                visuals,
                completed: completed ?? false,
                paper: assistLevel === "paper",
                reveal: revealOnMount,
              }}
              onActiveChange={setDrawn3d}
            />
          </Suspense>
        )}
        <div
          ref={gridRef}
          style={{
            width: boardPx,
            height: boardPx,
            gridTemplateColumns: `repeat(3, ${boxPx}px)`,
            gridTemplateRows: `repeat(3, ${boxPx}px)`,
          }}
          className="relative grid gap-[2px] bg-board-border p-[2px] shadow-lg shadow-black/8 dark:shadow-black/25 touch-none"
          data-board-3d={show3d ? "" : undefined}
          role="grid"
          aria-label="Sudoku board"
          aria-rowcount={9}
          aria-colcount={9}
          aria-multiselectable={onSetSelectedCells ? true : undefined}
          data-board-glow
          onPointerDown={
            onSetSelectedCells ? dragHandlers.onPointerDown : undefined
          }
          onPointerMove={
            onSetSelectedCells ? dragHandlers.onPointerMove : undefined
          }
          onPointerUp={
            onSetSelectedCells ? dragHandlers.onPointerUp : undefined
          }
          onClickCapture={
            onSetSelectedCells ? dragHandlers.onClickCapture : undefined
          }
        >
          {/* The DOM groups cells by 3x3 box so the nested CSS grids can
            paint thin in-box and thick between-box gaps. Rows cut across
            three boxes, so each ARIA row adopts its cells via aria-owns
            and the box wrappers are presentational. The row nodes are
            out of flow (sr-only) so they never take a grid slot. */}
          {Array.from({ length: 9 }, (_, r) => (
            // biome-ignore lint/a11y/useFocusableInteractive: grid rows are structural; focus lives on the gridcells (roving tabindex)
            <div
              key={`row-${r}`}
              role="row"
              aria-rowindex={r + 1}
              aria-owns={Array.from({ length: 9 }, (_, c) => cellId(r, c)).join(
                " ",
              )}
              className="sr-only"
            />
          ))}
          {Array.from({ length: 9 }, (_, boxIdx) => {
            const boxRow = Math.floor(boxIdx / 3);
            const boxCol = boxIdx % 3;
            return (
              <div
                key={boxIdx}
                style={{
                  gridTemplateColumns: `repeat(3, ${cellPx}px)`,
                  gridTemplateRows: `repeat(3, ${cellPx}px)`,
                }}
                className="grid gap-px bg-border-default"
                role="none"
              >
                {Array.from({ length: 9 }, (_, cellIdx) => {
                  const rowIdx = boxRow * 3 + Math.floor(cellIdx / 3);
                  const colIdx = boxCol * 3 + (cellIdx % 3);
                  const cell = board[rowIdx]![colIdx]!;
                  const {
                    isSelected,
                    isMultiSelected,
                    isHighlighted,
                    isSameNumber,
                    isConflict,
                    isHintRelated,
                    isSameNumberRowCol,
                    isDragSource,
                    dropTargetState,
                    dropMode,
                    dropDigit,
                  } = visuals[cellKey(rowIdx, colIdx)]!;

                  return (
                    <Cell
                      key={cellKey(rowIdx, colIdx)}
                      id={cellId(rowIdx, colIdx)}
                      cell={cell}
                      row={rowIdx}
                      col={colIdx}
                      isSelected={isSelected}
                      isMultiSelected={isMultiSelected}
                      isHighlighted={isHighlighted}
                      isSameNumber={isSameNumber}
                      isConflict={isConflict}
                      isHintRelated={isHintRelated}
                      isSameNumberRowCol={isSameNumberRowCol}
                      assistLevel={assistLevel}
                      isTabStop={
                        tabStop.row === rowIdx && tabStop.col === colIdx
                      }
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
      <BoardAnnouncer
        board={board}
        conflicts={conflicts}
        completed={completed}
      />
    </div>
  );
}
