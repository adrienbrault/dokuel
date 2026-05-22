import { useCallback, useState } from "react";
import type { Position } from "../lib/types.ts";

type Handlers = {
  selectedCell: Position | null;
  selectedCells: Set<number>;
  selectCell: (row: number, col: number) => void;
  setSelectedCells: (cells: Set<number>, primary: Position) => void;
  deselectCell: () => void;
  placeNumberAt: (
    row: number,
    col: number,
    value: number,
    autoEliminateNotes?: boolean,
  ) => void;
};

/**
 * Coordinates digit-first numpad input with board-wide same-number
 * highlighting. Tracks the digit (1-9) the player has made active; only
 * one is active at a time.
 *
 * A numpad tap (`tapDigit`) makes a digit active and drops any cell
 * selection. A cell tap (`tapCell`) then fills that cell with the
 * active digit, which stays active so several cells can be filled in a
 * row; with no digit active a cell tap selects the cell instead.
 *
 * Returns wrapped versions of the game's select handlers so callers
 * don't have to remember to clear the active digit at every selection
 * entry point.
 */
export function useDigitHighlight(
  {
    selectedCell,
    selectedCells,
    selectCell,
    setSelectedCells,
    deselectCell,
    placeNumberAt,
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

  // Numpad digit tap (digit-first input): with a cell selected, drop the
  // selection and make this digit active. With nothing selected, toggle
  // the digit's board-wide highlight.
  const tapDigit = useCallback(
    (n: number) => {
      if (selectedCell || selectedCells.size > 0) {
        deselectCell();
        setHighlightedDigit(n);
      } else {
        toggle(n);
      }
    },
    [selectedCell, selectedCells, deselectCell, toggle],
  );

  // Cell tap: with a digit active, fill the cell with it and keep the
  // digit active for the next tap; otherwise select the cell.
  const tapCell = useCallback(
    (row: number, col: number) => {
      if (highlightedDigit !== null) {
        placeNumberAt(row, col, highlightedDigit, autoEliminateNotes);
      } else {
        wrappedSelectCell(row, col);
      }
    },
    [highlightedDigit, placeNumberAt, autoEliminateNotes, wrappedSelectCell],
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
    tapCell,
    selectCell: wrappedSelectCell,
    setSelectedCells: wrappedSetSelectedCells,
    deselectCell: wrappedDeselectCell,
    skimToDigit,
  };
}
