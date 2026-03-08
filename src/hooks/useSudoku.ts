import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { haptics } from "../lib/haptics.ts";
import { sounds } from "../lib/sounds.ts";
import {
  cellKey,
  getConflicts,
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
  status: GameStatus;
  selectedCell: Position | null;
  notesMode: boolean;
  history: MoveAction[];
};

type Action =
  | { type: "SELECT_CELL"; row: number; col: number }
  | { type: "DESELECT_CELL" }
  | { type: "PLACE_NUMBER"; value: number }
  | { type: "ERASE" }
  | { type: "UNDO" }
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
      return { ...state, selectedCell: { row: action.row, col: action.col } };
    }

    case "DESELECT_CELL": {
      return { ...state, selectedCell: null };
    }

    case "PLACE_NUMBER": {
      if (!state.selectedCell || state.status === "completed") return state;
      const { row, col } = state.selectedCell;
      const cell = state.board[row]![col]!;
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
      const { row, col } = lastAction.position;

      switch (lastAction.type) {
        case "place": {
          board[row]![col]!.value = lastAction.previousValue;
          board[row]![col]!.notes = new Set(lastAction.previousNotes);
          // Restore auto-cleared notes from peers
          for (const cleared of lastAction.clearedNotes) {
            board[cleared.row]![cleared.col]!.notes.add(cleared.note);
          }
          break;
        }
        case "erase": {
          board[row]![col]!.value = lastAction.previousValue;
          board[row]![col]!.notes = new Set(lastAction.previousNotes);
          break;
        }
        case "toggleNote": {
          const notes = board[row]![col]!.notes;
          if (notes.has(lastAction.note)) {
            notes.delete(lastAction.note);
          } else {
            notes.add(lastAction.note);
          }
          break;
        }
      }

      return { ...state, board, history };
    }

    case "TOGGLE_NOTES": {
      return { ...state, notesMode: !state.notesMode };
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
    status: "playing",
    selectedCell: null,
    notesMode: false,
    history: [],
  };
}

export function useSudoku(puzzle: string, savedBoard?: SavedBoard) {
  const [state, dispatch] = useReducer(
    reducer,
    { puzzle, savedBoard },
    initState,
  );

  const conflicts = useMemo(() => getConflicts(state.board), [state.board]);

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

  // Haptic + sound feedback for conflicts and completion
  const prevConflictSize = useRef(conflicts.size);
  useEffect(() => {
    if (conflicts.size > prevConflictSize.current) {
      haptics.conflict();
      sounds.conflict();
    }
    prevConflictSize.current = conflicts.size;
  }, [conflicts]);

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

  return {
    board: state.board,
    puzzle,
    status: state.status,
    selectedCell: state.selectedCell,
    notesMode: state.notesMode,
    conflicts,
    remainingCounts,
    cellsRemaining,
    historyLength: state.history.length,
    cellKey,
    selectCell,
    deselectCell,
    placeNumber,
    erase,
    undo,
    toggleNotesMode,
  };
}
