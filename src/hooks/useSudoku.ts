import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  initState,
  projectBoard,
  reducer,
  type SavedBoard,
} from "../lib/board-engine.ts";
import { gameFeedback } from "../lib/game-feedback.ts";
import { cellKey } from "../lib/sudoku.ts";
import type { Position } from "../lib/types.ts";

export type { SavedBoard } from "../lib/board-engine.ts";

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

  const { conflicts, errors, remainingCounts, cellsRemaining } = useMemo(
    () => projectBoard(state.board, state.solution),
    [state.board, state.solution],
  );

  // Sensory feedback for errors and completion
  const errorFeedback = state.solution ? errors : conflicts;
  const prevErrorSize = useRef(errorFeedback.size);
  useEffect(() => {
    if (errorFeedback.size > prevErrorSize.current) {
      gameFeedback.onConflict();
    }
    prevErrorSize.current = errorFeedback.size;
  }, [errorFeedback]);

  useEffect(() => {
    if (state.status === "completed") {
      gameFeedback.onComplete();
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
    (value: number, autoEliminateNotes = true, asNote?: boolean) => {
      gameFeedback.onPlace();
      dispatch({ type: "PLACE_NUMBER", value, autoEliminateNotes, asNote });
    },
    [],
  );

  // Toggle a note at an explicit cell without selecting it — the drag
  // layer drops notes this way so the board highlight stays put.
  const placeNoteAt = useCallback((row: number, col: number, value: number) => {
    gameFeedback.onPlace();
    dispatch({ type: "PLACE_NOTE_AT", row, col, value });
  }, []);

  // Place a value at an explicit cell without selecting it — digit-first
  // numpad input fills the tapped cell this way so the selection stays
  // off and the active digit's highlight stays put.
  const placeNumberAt = useCallback(
    (row: number, col: number, value: number, autoEliminateNotes = true) => {
      gameFeedback.onPlace();
      dispatch({
        type: "PLACE_NUMBER_AT",
        row,
        col,
        value,
        autoEliminateNotes,
      });
    },
    [],
  );

  const erase = useCallback(() => {
    gameFeedback.onErase();
    dispatch({ type: "ERASE" });
  }, []);
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);

  const toggleNotesMode = useCallback(() => {
    gameFeedback.onToggleNotes();
    dispatch({ type: "TOGGLE_NOTES" });
  }, []);

  const hint = useCallback(() => {
    gameFeedback.onHint();
    dispatch({ type: "HINT" });
  }, []);

  const dismissHint = useCallback(() => dispatch({ type: "DISMISS_HINT" }), []);

  const reset = useCallback(
    (nextPuzzle: string, nextSolution?: string, nextSaved?: SavedBoard) =>
      dispatch({
        type: "RESET",
        puzzle: nextPuzzle,
        solution: nextSolution,
        savedBoard: nextSaved,
      }),
    [],
  );

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
    placeNoteAt,
    placeNumberAt,
    erase,
    undo,
    activeHint: state.activeHint,
    toggleNotesMode,
    hint,
    dismissHint,
    reset,
  };
}
