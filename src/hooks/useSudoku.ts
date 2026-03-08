import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { haptics } from "../lib/haptics.ts";
import { sounds } from "../lib/sounds.ts";
import {
  cellKey,
  getConflicts,
  getErrors,
  isBoardComplete,
  parsePuzzle,
} from "../lib/sudoku.ts";
import type {
  Board,
  ClearedNote,
  GameStatus,
  MoveAction,
  Position,
} from "../lib/types.ts";

type State = {
  board: Board;
  solution: string | null;
  status: GameStatus;
  selectedCell: Position | null;
  selectedCells: Set<number>;
  notesMode: boolean;
  history: MoveAction[];
  hintsUsed: number;
};

type Action =
  | { type: "SELECT_CELL"; row: number; col: number }
  | { type: "DESELECT_CELL" }
  | { type: "SET_SELECTED_CELLS"; cells: Set<number>; primary: Position }
  | { type: "PLACE_NUMBER"; value: number }
  | { type: "ERASE" }
  | { type: "UNDO" }
  | { type: "HINT" }
  | { type: "TOGGLE_NOTES" };

function cloneBoard(board: Board): Board {
  return board.map((row) =>
    row.map((cell) => ({
      ...cell,
      notes: new Set(cell.notes),
    })),
  );
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SELECT_CELL": {
      const key = cellKey(action.row, action.col);
      return {
        ...state,
        selectedCell: { row: action.row, col: action.col },
        selectedCells: new Set([key]),
      };
    }

    case "DESELECT_CELL": {
      return { ...state, selectedCell: null, selectedCells: new Set() };
    }

    case "SET_SELECTED_CELLS": {
      return {
        ...state,
        selectedCell: action.primary,
        selectedCells: action.cells,
      };
    }

    case "PLACE_NUMBER": {
      if (!state.selectedCell || state.status === "completed") return state;
      const { row, col } = state.selectedCell;
      const cell = state.board[row]![col]!;

      // Multi-cell batch note toggle
      if (state.notesMode && state.selectedCells.size > 1) {
        const board = cloneBoard(state.board);
        const targets: Position[] = [];
        for (const key of state.selectedCells) {
          const r = Math.floor(key / 9);
          const c = key % 9;
          const target = board[r]![c]!;
          if (!target.isGiven && target.value === null) {
            targets.push({ row: r, col: c });
          }
        }
        if (targets.length === 0) return state;

        // If all targets have the note, remove it; otherwise add it
        const allHave = targets.every((p) =>
          board[p.row]![p.col]!.notes.has(action.value),
        );
        const added: Position[] = [];
        const removed: Position[] = [];
        for (const pos of targets) {
          const notes = board[pos.row]![pos.col]!.notes;
          if (allHave) {
            notes.delete(action.value);
            removed.push(pos);
          } else if (!notes.has(action.value)) {
            notes.add(action.value);
            added.push(pos);
          }
        }
        if (added.length === 0 && removed.length === 0) return state;
        const moveAction: MoveAction = {
          type: "batchToggleNote",
          note: action.value,
          added,
          removed,
        };
        return {
          ...state,
          board,
          history: [...state.history, moveAction],
        };
      }

      if (cell.isGiven) return state;

      if (state.notesMode) {
        const board = cloneBoard(state.board);
        const notes = board[row]![col]!.notes;
        const moveAction: MoveAction = {
          type: "toggleNote",
          position: { row, col },
          note: action.value,
        };
        if (notes.has(action.value)) {
          notes.delete(action.value);
        } else {
          notes.add(action.value);
        }
        return {
          ...state,
          board,
          history: [...state.history, moveAction],
        };
      }

      const board = cloneBoard(state.board);
      board[row]![col]!.value = action.value;
      board[row]![col]!.notes = new Set();

      // Auto-clear matching notes from peers in same row, column, and box
      const clearedNotes: ClearedNote[] = [];
      const boxRow = Math.floor(row / 3) * 3;
      const boxCol = Math.floor(col / 3) * 3;
      for (let i = 0; i < 9; i++) {
        // Same row
        if (i !== col && board[row]![i]!.notes.has(action.value)) {
          board[row]![i]!.notes.delete(action.value);
          clearedNotes.push({ row, col: i, note: action.value });
        }
        // Same column
        if (i !== row && board[i]![col]!.notes.has(action.value)) {
          board[i]![col]!.notes.delete(action.value);
          clearedNotes.push({ row: i, col, note: action.value });
        }
      }
      // Same 3x3 box (skip cells already handled by row/col)
      for (let r = boxRow; r < boxRow + 3; r++) {
        for (let c = boxCol; c < boxCol + 3; c++) {
          if (r !== row && c !== col && board[r]![c]!.notes.has(action.value)) {
            board[r]![c]!.notes.delete(action.value);
            clearedNotes.push({ row: r, col: c, note: action.value });
          }
        }
      }

      const moveAction: MoveAction = {
        type: "place",
        position: { row, col },
        value: action.value,
        previousValue: cell.value,
        previousNotes: new Set(cell.notes),
        clearedNotes,
      };
      const conflicts = getConflicts(board);
      const complete = isBoardComplete(board, conflicts);

      return {
        ...state,
        board,
        status: complete ? "completed" : state.status,
        history: [...state.history, moveAction],
      };
    }

    case "ERASE": {
      if (!state.selectedCell || state.status === "completed") return state;

      // Multi-cell batch erase
      if (state.selectedCells.size > 1) {
        const board = cloneBoard(state.board);
        const erased: {
          position: Position;
          previousValue: import("../lib/types.ts").CellValue;
          previousNotes: Set<number>;
        }[] = [];
        for (const key of state.selectedCells) {
          const r = Math.floor(key / 9);
          const c = key % 9;
          const target = board[r]![c]!;
          if (
            !target.isGiven &&
            (target.value !== null || target.notes.size > 0)
          ) {
            erased.push({
              position: { row: r, col: c },
              previousValue: target.value,
              previousNotes: new Set(target.notes),
            });
            target.value = null;
            target.notes = new Set();
          }
        }
        if (erased.length === 0) return state;
        const moveAction: MoveAction = {
          type: "batchErase",
          cells: erased,
        };
        return {
          ...state,
          board,
          history: [...state.history, moveAction],
        };
      }

      const { row, col } = state.selectedCell;
      const cell = state.board[row]![col]!;
      if (cell.isGiven) return state;

      const board = cloneBoard(state.board);
      const moveAction: MoveAction = {
        type: "erase",
        position: { row, col },
        previousValue: cell.value,
        previousNotes: new Set(cell.notes),
      };
      board[row]![col]!.value = null;
      board[row]![col]!.notes = new Set();

      return {
        ...state,
        board,
        history: [...state.history, moveAction],
      };
    }

    case "UNDO": {
      if (state.history.length === 0 || state.status === "completed")
        return state;
      const history = state.history.slice(0, -1);
      const lastAction = state.history[state.history.length - 1]!;
      const board = cloneBoard(state.board);

      switch (lastAction.type) {
        case "place": {
          const { row, col } = lastAction.position;
          board[row]![col]!.value = lastAction.previousValue;
          board[row]![col]!.notes = new Set(lastAction.previousNotes);
          // Restore auto-cleared notes from peers
          for (const cleared of lastAction.clearedNotes) {
            board[cleared.row]![cleared.col]!.notes.add(cleared.note);
          }
          break;
        }
        case "erase": {
          const { row, col } = lastAction.position;
          board[row]![col]!.value = lastAction.previousValue;
          board[row]![col]!.notes = new Set(lastAction.previousNotes);
          break;
        }
        case "toggleNote": {
          const { row, col } = lastAction.position;
          const notes = board[row]![col]!.notes;
          if (notes.has(lastAction.note)) {
            notes.delete(lastAction.note);
          } else {
            notes.add(lastAction.note);
          }
          break;
        }
        case "batchToggleNote": {
          for (const pos of lastAction.added) {
            board[pos.row]![pos.col]!.notes.delete(lastAction.note);
          }
          for (const pos of lastAction.removed) {
            board[pos.row]![pos.col]!.notes.add(lastAction.note);
          }
          break;
        }
        case "batchErase": {
          for (const entry of lastAction.cells) {
            const { row, col } = entry.position;
            board[row]![col]!.value = entry.previousValue;
            board[row]![col]!.notes = new Set(entry.previousNotes);
          }
          break;
        }
        case "hint": {
          const { row, col } = lastAction.position;
          board[row]![col]!.value = null;
          board[row]![col]!.notes = new Set(lastAction.previousNotes);
          for (const cleared of lastAction.clearedNotes) {
            board[cleared.row]![cleared.col]!.notes.add(cleared.note);
          }
          break;
        }
      }

      return {
        ...state,
        board,
        history,
        hintsUsed:
          lastAction.type === "hint"
            ? Math.max(0, state.hintsUsed - 1)
            : state.hintsUsed,
      };
    }

    case "TOGGLE_NOTES": {
      return { ...state, notesMode: !state.notesMode };
    }

    case "HINT": {
      if (!state.solution || state.status === "completed") return state;

      // Find the target cell: selected empty cell, or first empty cell
      let targetRow = -1;
      let targetCol = -1;
      if (
        state.selectedCell &&
        state.board[state.selectedCell.row]![state.selectedCell.col]!.value ===
          null
      ) {
        targetRow = state.selectedCell.row;
        targetCol = state.selectedCell.col;
      } else {
        for (let r = 0; r < 9 && targetRow === -1; r++) {
          for (let c = 0; c < 9; c++) {
            if (state.board[r]![c]!.value === null) {
              targetRow = r;
              targetCol = c;
              break;
            }
          }
        }
      }
      if (targetRow === -1) return state;

      const hintValue = Number(state.solution[targetRow * 9 + targetCol]);
      const cell = state.board[targetRow]![targetCol]!;
      const board = cloneBoard(state.board);
      board[targetRow]![targetCol]!.value = hintValue;
      board[targetRow]![targetCol]!.notes = new Set();

      // Auto-clear notes from peers (same as PLACE_NUMBER)
      const clearedNotes: ClearedNote[] = [];
      const boxRow = Math.floor(targetRow / 3) * 3;
      const boxCol = Math.floor(targetCol / 3) * 3;
      for (let i = 0; i < 9; i++) {
        if (i !== targetCol && board[targetRow]![i]!.notes.has(hintValue)) {
          board[targetRow]![i]!.notes.delete(hintValue);
          clearedNotes.push({ row: targetRow, col: i, note: hintValue });
        }
        if (i !== targetRow && board[i]![targetCol]!.notes.has(hintValue)) {
          board[i]![targetCol]!.notes.delete(hintValue);
          clearedNotes.push({ row: i, col: targetCol, note: hintValue });
        }
      }
      for (let r = boxRow; r < boxRow + 3; r++) {
        for (let c = boxCol; c < boxCol + 3; c++) {
          if (
            r !== targetRow &&
            c !== targetCol &&
            board[r]![c]!.notes.has(hintValue)
          ) {
            board[r]![c]!.notes.delete(hintValue);
            clearedNotes.push({ row: r, col: c, note: hintValue });
          }
        }
      }

      const moveAction: MoveAction = {
        type: "hint",
        position: { row: targetRow, col: targetCol },
        value: hintValue,
        previousNotes: new Set(cell.notes),
        clearedNotes,
      };
      const conflicts = getConflicts(board);
      const complete = isBoardComplete(board, conflicts);

      return {
        ...state,
        board,
        status: complete ? "completed" : state.status,
        selectedCell: { row: targetRow, col: targetCol },
        selectedCells: new Set([cellKey(targetRow, targetCol)]),
        history: [...state.history, moveAction],
        hintsUsed: state.hintsUsed + 1,
      };
    }

    default:
      return state;
  }
}

export type SavedBoard = {
  values: string;
  notes: number[][];
};

function initState(args: {
  puzzle: string;
  solution?: string | undefined;
  savedBoard?: SavedBoard | undefined;
}): State {
  const board = parsePuzzle(args.puzzle);
  if (args.savedBoard) {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const cell = board[row]![col]!;
        if (!cell.isGiven) {
          const i = row * 9 + col;
          const ch = args.savedBoard.values[i];
          cell.value = ch === "." ? null : Number(ch);
          cell.notes = new Set(args.savedBoard.notes[i] ?? []);
        }
      }
    }
  }
  return {
    board,
    solution: args.solution ?? null,
    status: "playing",
    selectedCell: null,
    selectedCells: new Set(),
    notesMode: false,
    history: [],
    hintsUsed: 0,
  };
}

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

  const placeNumber = useCallback((value: number) => {
    haptics.tap();
    sounds.place();
    dispatch({ type: "PLACE_NUMBER", value });
  }, []);

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
    sounds.place();
    dispatch({ type: "HINT" });
  }, []);

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
    toggleNotesMode,
    hint,
  };
}
