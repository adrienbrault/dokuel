import { findHint } from "../lib/hint-engine.ts";
import { cellKey, parsePuzzle } from "../lib/sudoku.ts";
import type {
  ActiveHint,
  Board,
  GameStatus,
  MoveAction,
  Position,
} from "../lib/types.ts";
import { cloneBoard, handleErase, handlePlaceNumber } from "./sudokuActions.ts";

export type State = {
  board: Board;
  solution: string | null;
  status: GameStatus;
  selectedCell: Position | null;
  selectedCells: Set<number>;
  notesMode: boolean;
  history: MoveAction[];
  hintsUsed: number;
  activeHint: ActiveHint | null;
};

export type Action =
  | { type: "SELECT_CELL"; row: number; col: number }
  | { type: "DESELECT_CELL" }
  | { type: "SET_SELECTED_CELLS"; cells: Set<number>; primary: Position }
  | { type: "PLACE_NUMBER"; value: number; autoEliminateNotes: boolean }
  | { type: "ERASE" }
  | { type: "UNDO" }
  | { type: "HINT" }
  | { type: "DISMISS_HINT" }
  | { type: "TOGGLE_NOTES" };

export type SavedBoard = {
  values: string;
  notes: number[][];
};

function handleUndo(state: State): State {
  if (state.history.length === 0 || state.status === "completed") return state;
  const history = state.history.slice(0, -1);
  const lastAction = state.history[state.history.length - 1]!;
  const board = cloneBoard(state.board);

  switch (lastAction.type) {
    case "place": {
      const { row, col } = lastAction.position;
      board[row]![col]!.value = lastAction.previousValue;
      board[row]![col]!.notes = new Set(lastAction.previousNotes);
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
    activeHint: null,
  };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SELECT_CELL": {
      const key = cellKey(action.row, action.col);
      return {
        ...state,
        selectedCell: { row: action.row, col: action.col },
        selectedCells: new Set([key]),
        activeHint: null,
      };
    }

    case "DESELECT_CELL":
      return {
        ...state,
        selectedCell: null,
        selectedCells: new Set(),
        activeHint: null,
      };

    case "SET_SELECTED_CELLS":
      return {
        ...state,
        selectedCell: action.primary,
        selectedCells: action.cells,
        activeHint: null,
      };

    case "PLACE_NUMBER":
      return handlePlaceNumber(state, action.value, action.autoEliminateNotes);

    case "ERASE":
      return handleErase(state);

    case "UNDO":
      return handleUndo(state);

    case "TOGGLE_NOTES":
      return { ...state, notesMode: !state.notesMode };

    case "DISMISS_HINT":
      return { ...state, activeHint: null };

    case "HINT": {
      if (!state.solution || state.status === "completed") return state;

      const hint = findHint(state.board, state.solution, state.selectedCell);
      if (!hint) return state;

      return {
        ...state,
        selectedCell: hint.position,
        selectedCells: new Set([cellKey(hint.position.row, hint.position.col)]),
        activeHint: hint,
        hintsUsed: state.hintsUsed + 1,
      };
    }

    default:
      return state;
  }
}

export function initState(args: {
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
    activeHint: null,
  };
}
