import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { haptics } from "../lib/haptics.ts";
import { sounds } from "../lib/sounds.ts";
import {
  cellKey,
  getConflicts,
  isBoardComplete,
  parsePuzzle,
} from "../lib/sudoku.ts";
import type { Board, GameStatus, MoveAction, Position } from "../lib/types.ts";

type State = {
  board: Board;
  status: GameStatus;
  selectedCell: Position | null;
  notesMode: boolean;
  history: MoveAction[];
};

type Action =
  | { type: "SELECT_CELL"; row: number; col: number }
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

    case "PLACE_NUMBER": {
      if (!state.selectedCell || state.status === "completed") return state;
      const { row, col } = state.selectedCell;
      const cell = state.board[row][col];
      if (cell.isGiven) return state;

      if (state.notesMode) {
        const board = cloneBoard(state.board);
        const notes = board[row][col].notes;
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
      const moveAction: MoveAction = {
        type: "place",
        position: { row, col },
        value: action.value,
        previousValue: cell.value,
        previousNotes: new Set(cell.notes),
      };
      board[row][col].value = action.value;
      board[row][col].notes = new Set();
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
      const cell = state.board[row][col];
      if (cell.isGiven) return state;

      const board = cloneBoard(state.board);
      const moveAction: MoveAction = {
        type: "erase",
        position: { row, col },
        previousValue: cell.value,
        previousNotes: new Set(cell.notes),
      };
      board[row][col].value = null;
      board[row][col].notes = new Set();

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
      const lastAction = state.history[state.history.length - 1];
      const board = cloneBoard(state.board);
      const { row, col } = lastAction.position;

      switch (lastAction.type) {
        case "place":
        case "erase": {
          board[row][col].value = lastAction.previousValue;
          board[row][col].notes = new Set(lastAction.previousNotes);
          break;
        }
        case "toggleNote": {
          const notes = board[row][col].notes;
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

function initState(puzzle: string): State {
  const board = parsePuzzle(puzzle);
  return {
    board,
    status: "playing",
    selectedCell: null,
    notesMode: false,
    history: [],
  };
}

export function useSudoku(puzzle: string, _solution: string) {
  const [state, dispatch] = useReducer(reducer, puzzle, initState);

  const conflicts = useMemo(() => getConflicts(state.board), [state.board]);

  const { remainingCounts, cellsRemaining } = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let d = 1; d <= 9; d++) counts[d] = 9;
    let empty = 0;
    for (const row of state.board) {
      for (const cell of row) {
        if (cell.value !== null && cell.value >= 1 && cell.value <= 9) {
          counts[cell.value]--;
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
    status: state.status,
    selectedCell: state.selectedCell,
    notesMode: state.notesMode,
    conflicts,
    remainingCounts,
    cellsRemaining,
    cellKey,
    selectCell,
    placeNumber,
    erase,
    undo,
    toggleNotesMode,
  };
}
