import { useCallback, useState } from "react";
import type { Position } from "../lib/types.ts";

type Handlers = {
  selectCell: (row: number, col: number) => void;
  setSelectedCells: (cells: Set<number>, primary: Position) => void;
};

/**
 * Tracks the digit (1-9) the player has toggled on via the numpad for
 * board-wide same-number highlighting. Only one digit is active at a
 * time; tapping the active digit toggles it off, and any selection
 * change clears it so the selection's own value drives the board.
 *
 * Returns wrapped versions of the game's select handlers so callers
 * don't have to remember to clear() at every selection entry point.
 */
export function useDigitHighlight({ selectCell, setSelectedCells }: Handlers) {
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

  return {
    highlightedDigit,
    toggle,
    setDigit,
    selectCell: wrappedSelectCell,
    setSelectedCells: wrappedSetSelectedCells,
  };
}
