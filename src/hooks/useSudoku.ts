import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { haptics } from "../lib/haptics.ts";
import { sounds } from "../lib/sounds.ts";
import { cellKey, getConflicts, getErrors } from "../lib/sudoku.ts";
import type { Position } from "../lib/types.ts";
import { initState, reducer, type SavedBoard } from "./sudokuReducer.ts";

export type { SavedBoard } from "./sudokuReducer.ts";

export function useSudoku(
  puzzle: string,
  solution?: string,
  savedBoard?: SavedBoard,
) {
  const [state, dispatch] = useReducer(
    reducer,
    { puzzle, solution, savedBoard },
    initState,
  );

  const conflicts = useMemo(() => getConflicts(state.board), [state.board]);

  const errors = useMemo(
    () =>
      state.solution
        ? getErrors(state.board, state.solution)
        : new Set<number>(),
    [state.board, state.solution],
  );

  const { remainingCounts, cellsRemaining } = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let d = 1; d <= 9; d++) counts[d] = 9;
    let empty = 0;
    for (const row of state.board) {
      for (const cell of row) {
        if (cell.value !== null && cell.value >= 1 && cell.value <= 9) {
          counts[cell.value]!--;
        } else {
          empty++;
        }
      }
    }
    return { remainingCounts: counts, cellsRemaining: empty };
  }, [state.board]);

  // Haptic + sound feedback for errors and completion
  const errorFeedback = state.solution ? errors : conflicts;
  const prevErrorSize = useRef(errorFeedback.size);
  useEffect(() => {
    if (errorFeedback.size > prevErrorSize.current) {
      haptics.conflict();
      sounds.conflict();
    }
    prevErrorSize.current = errorFeedback.size;
  }, [errorFeedback]);

  useEffect(() => {
    if (state.status === "completed") {
      haptics.success();
      sounds.complete();
    }
  }, [state.status]);

  const selectCell = useCallback(
    (row: number, col: number) => dispatch({ type: "SELECT_CELL", row, col }),
    [],
  );

  const deselectCell = useCallback(
    () => dispatch({ type: "DESELECT_CELL" }),
    [],
  );

  const setSelectedCells = useCallback(
    (cells: Set<number>, primary: Position) =>
      dispatch({ type: "SET_SELECTED_CELLS", cells, primary }),
    [],
  );

  const placeNumber = useCallback(
    (value: number, autoEliminateNotes = true) => {
      haptics.tap();
      sounds.place();
      dispatch({ type: "PLACE_NUMBER", value, autoEliminateNotes });
    },
    [],
  );

  const erase = useCallback(() => {
    haptics.tap();
    sounds.erase();
    dispatch({ type: "ERASE" });
  }, []);
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);

  const toggleNotesMode = useCallback(() => {
    haptics.light();
    sounds.note();
    dispatch({ type: "TOGGLE_NOTES" });
  }, []);

  const hint = useCallback(() => {
    haptics.tap();
    dispatch({ type: "HINT" });
  }, []);

  const dismissHint = useCallback(() => dispatch({ type: "DISMISS_HINT" }), []);

  return {
    board: state.board,
    puzzle,
    status: state.status,
    selectedCell: state.selectedCell,
    selectedCells: state.selectedCells,
    notesMode: state.notesMode,
    conflicts,
    errors,
    remainingCounts,
    cellsRemaining,
    historyLength: state.history.length,
    hintsUsed: state.hintsUsed,
    cellKey,
    selectCell,
    deselectCell,
    setSelectedCells,
    placeNumber,
    erase,
    undo,
    activeHint: state.activeHint,
    toggleNotesMode,
    hint,
    dismissHint,
  };
}
