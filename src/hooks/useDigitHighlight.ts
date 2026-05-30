import { useCallback, useState } from "react";
import type { Board, Position } from "../lib/types.ts";

type Handlers = {
  board: Board;
  selectedCell: Position | null;
  selectedCells: Set<number>;
  selectCell: (row: number, col: number) => void;
  setSelectedCells: (cells: Set<number>, primary: Position) => void;
  deselectCell: () => void;
  placeNumber: (
    value: number,
    autoEliminateNotes?: boolean,
    asNote?: boolean,
  ) => void;
};

/**
 * Tracks the digit (1-9) the player has toggled on via the numpad for
 * board-wide same-number highlighting, and routes the numpad tap.
 *
 * `tapDigit` is the quick-tap handler. With nothing selected it toggles
 * the digit's highlight. With a single empty cell selected it places the
 * value, as before. But when the selected cell already holds a value —
 * where a tap could not place anything anyway — or when multiple cells
 * are selected — where a tap can't meaningfully fill a range — it is
 * repurposed: the selection is dropped and that digit becomes the
 * active highlight.
 *
 * Returns wrapped versions of the game's select handlers so callers
 * don't have to remember to clear the active digit at every selection
 * entry point.
 */
export function useDigitHighlight(
  {
    board,
    selectedCell,
    selectedCells,
    selectCell,
    setSelectedCells,
    deselectCell,
    placeNumber,
  }: Handlers,
  autoEliminateNotes = true,
) {
  const [highlightedDigit, setHighlightedDigit] = useState<number | null>(null);

  const toggle = useCallback((n: number) => {
    setHighlightedDigit((prev) => (prev === n ? null : n));
  }, []);

  const setDigit = useCallback((n: number) => {
    setHighlightedDigit(n);
  }, []);

  const wrappedSelectCell = useCallback(
    (row: number, col: number) => {
      setHighlightedDigit(null);
      selectCell(row, col);
    },
    [selectCell],
  );

  const wrappedSetSelectedCells = useCallback(
    (cells: Set<number>, primary: Position) => {
      setHighlightedDigit(null);
      setSelectedCells(cells, primary);
    },
    [setSelectedCells],
  );

  const wrappedDeselectCell = useCallback(() => {
    setHighlightedDigit(null);
    deselectCell();
  }, [deselectCell]);

  // Numpad quick tap. Nothing selected → toggle the digit highlight.
  // Empty cell selected → place the value. Filled cell selected → a tap
  // can't overwrite it, so drop the selection and highlight the digit.
  const tapDigit = useCallback(
    (n: number) => {
      if (selectedCell === null && selectedCells.size === 0) {
        toggle(n);
        return;
      }
      // Multiple cells selected: a single tap can't meaningfully fill a
      // range, so drop the selection and make the tapped digit the
      // active highlight instead of silently committing one cell.
      if (selectedCells.size > 1) {
        deselectCell();
        setHighlightedDigit(n);
        return;
      }
      const onFilledCell =
        selectedCell !== null &&
        board[selectedCell.row]![selectedCell.col]!.value !== null;
      if (onFilledCell) {
        deselectCell();
        setHighlightedDigit(n);
      } else {
        placeNumber(n, autoEliminateNotes, false);
      }
    },
    [
      board,
      selectedCell,
      selectedCells,
      deselectCell,
      placeNumber,
      autoEliminateNotes,
      toggle,
    ],
  );

  // Skim across the numpad: make `digit` the active highlight and drop
  // any cell selection, so the board follows the finger instead of the
  // selected cell's own value.
  const skimToDigit = useCallback(
    (digit: number) => {
      setHighlightedDigit(digit);
      deselectCell();
    },
    [deselectCell],
  );

  return {
    highlightedDigit,
    toggle,
    setDigit,
    tapDigit,
    selectCell: wrappedSelectCell,
    setSelectedCells: wrappedSetSelectedCells,
    deselectCell: wrappedDeselectCell,
    skimToDigit,
  };
}
