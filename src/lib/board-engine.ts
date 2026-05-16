import { findHint } from "./hint-engine.ts";
import {
  cellKey,
  getConflicts,
  getErrors,
  isBoardComplete,
  parsePuzzle,
} from "./sudoku.ts";
import type {
  ActiveHint,
  Board,
  ClearedNote,
  GameStatus,
  MoveAction,
  Position,
} from "./types.ts";

/**
 * The Sudoku board engine: a pure reducer that owns the playable
 * board state (cells, history, selection, notes mode, hints) for a
 * single game. React hooks bind to this via `useReducer`.
 *
 * The engine's interface — `State`, `Action`, `reducer`, `initState`
 * — is the test surface. Tests exercise behaviour through actions and
 * assert on observable state; they don't reach into internal helpers.
 */

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
  | {
      type: "PLACE_NUMBER";
      value: number;
      autoEliminateNotes: boolean;
      asNote?: boolean | undefined;
    }
  | { type: "ERASE" }
  | { type: "UNDO" }
  | { type: "HINT" }
  | { type: "DISMISS_HINT" }
  | { type: "TOGGLE_NOTES" }
  | {
      type: "RESET";
      puzzle: string;
      solution?: string | undefined;
      savedBoard?: SavedBoard | undefined;
    };

export type SavedBoard = {
  values: string;
  notes: number[][];
};

function cloneBoard(board: Board): Board {
  return board.map((row) =>
    row.map((cell) => ({
      ...cell,
      notes: new Set(cell.notes),
    })),
  );
}

function clearPeerNotes(
  board: Board,
  row: number,
  col: number,
  value: number,
): ClearedNote[] {
  const cleared: ClearedNote[] = [];
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let i = 0; i < 9; i++) {
    if (i !== col && board[row]![i]!.notes.has(value)) {
      board[row]![i]!.notes.delete(value);
      cleared.push({ row, col: i, note: value });
    }
    if (i !== row && board[i]![col]!.notes.has(value)) {
      board[i]![col]!.notes.delete(value);
      cleared.push({ row: i, col, note: value });
    }
  }
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (r !== row && c !== col && board[r]![c]!.notes.has(value)) {
        board[r]![c]!.notes.delete(value);
        cleared.push({ row: r, col: c, note: value });
      }
    }
  }
  return cleared;
}

function handlePlaceNumber(
  state: State,
  value: number,
  autoEliminateNotes: boolean,
  asNote?: boolean,
): State {
  if (!state.selectedCell || state.status === "completed") return state;
  const { row, col } = state.selectedCell;
  const cell = state.board[row]![col]!;
  const noteMode = asNote ?? state.notesMode;

  // Multi-cell batch note toggle
  if (noteMode && state.selectedCells.size > 1) {
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
      board[p.row]![p.col]!.notes.has(value),
    );
    const added: Position[] = [];
    const removed: Position[] = [];
    for (const pos of targets) {
      const notes = board[pos.row]![pos.col]!.notes;
      if (allHave) {
        notes.delete(value);
        removed.push(pos);
      } else if (!notes.has(value)) {
        notes.add(value);
        added.push(pos);
      }
    }
    if (added.length === 0 && removed.length === 0) return state;
    const moveAction: MoveAction = {
      type: "batchToggleNote",
      note: value,
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

  if (noteMode) {
    const board = cloneBoard(state.board);
    const notes = board[row]![col]!.notes;
    const moveAction: MoveAction = {
      type: "toggleNote",
      position: { row, col },
      note: value,
    };
    if (notes.has(value)) {
      notes.delete(value);
    } else {
      notes.add(value);
    }
    return {
      ...state,
      board,
      history: [...state.history, moveAction],
    };
  }

  const board = cloneBoard(state.board);
  board[row]![col]!.value = value;
  board[row]![col]!.notes = new Set();
  const clearedNotes = autoEliminateNotes
    ? clearPeerNotes(board, row, col, value)
    : [];
  const moveAction: MoveAction = {
    type: "place",
    position: { row, col },
    value,
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

function handleErase(state: State): State {
  if (!state.selectedCell || state.status === "completed") return state;

  // Multi-cell batch erase
  if (state.selectedCells.size > 1) {
    const board = cloneBoard(state.board);
    const erased: {
      position: Position;
      previousValue: import("./types.ts").CellValue;
      previousNotes: Set<number>;
    }[] = [];
    for (const key of state.selectedCells) {
      const r = Math.floor(key / 9);
      const c = key % 9;
      const target = board[r]![c]!;
      if (!target.isGiven && (target.value !== null || target.notes.size > 0)) {
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
  };
}

function handleHint(state: State): State {
  if (!state.solution || state.status === "completed") return state;

  const hint = findHint(state.board, state.solution, state.selectedCell);
  if (!hint) return state;

  const { row, col } = hint.position;
  const board = cloneBoard(state.board);
  const cell = board[row]![col]!;
  const previousNotes = new Set(cell.notes);
  cell.value = hint.value;
  cell.notes = new Set();
  const clearedNotes = clearPeerNotes(board, row, col, hint.value);

  const moveAction: MoveAction = {
    type: "hint",
    position: hint.position,
    value: hint.value,
    previousNotes,
    clearedNotes,
  };

  const conflicts = getConflicts(board);
  const complete = isBoardComplete(board, conflicts);

  return {
    ...state,
    board,
    status: complete ? "completed" : state.status,
    selectedCell: hint.position,
    selectedCells: new Set([cellKey(row, col)]),
    activeHint: hint,
    hintsUsed: state.hintsUsed + 1,
    history: [...state.history, moveAction],
  };
}

function dispatchAction(state: State, action: Action): State {
  switch (action.type) {
    case "SELECT_CELL": {
      const key = cellKey(action.row, action.col);
      return {
        ...state,
        selectedCell: { row: action.row, col: action.col },
        selectedCells: new Set([key]),
      };
    }

    case "DESELECT_CELL":
      return {
        ...state,
        selectedCell: null,
        selectedCells: new Set(),
      };

    case "SET_SELECTED_CELLS":
      return {
        ...state,
        selectedCell: action.primary,
        selectedCells: action.cells,
      };

    case "PLACE_NUMBER":
      return handlePlaceNumber(
        state,
        action.value,
        action.autoEliminateNotes,
        action.asNote,
      );

    case "ERASE":
      return handleErase(state);

    case "UNDO":
      return handleUndo(state);

    case "TOGGLE_NOTES":
      return { ...state, notesMode: !state.notesMode };

    case "DISMISS_HINT":
      return state;

    case "HINT":
      return handleHint(state);

    case "RESET":
      return initState({
        puzzle: action.puzzle,
        solution: action.solution,
        savedBoard: action.savedBoard,
      });

    default:
      return state;
  }
}

// activeHint is cleared after any action except the two that own it:
// HINT installs a new hint, TOGGLE_NOTES is unrelated and can be
// toggled while a hint banner is showing.
export function reducer(state: State, action: Action): State {
  const next = dispatchAction(state, action);
  if (action.type === "HINT" || action.type === "TOGGLE_NOTES") return next;
  if (next.activeHint === null) return next;
  return { ...next, activeHint: null };
}

export type BoardProjection = {
  /** Cell keys (row*9+col) that participate in a row/col/box conflict. */
  conflicts: Set<number>;
  /** Cell keys whose user-entered value differs from the solution. Empty when no solution is supplied. */
  errors: Set<number>;
  /** How many times each digit 1–9 still needs to be placed. */
  remainingCounts: Record<number, number>;
  /** Empty cell count (0–81). */
  cellsRemaining: number;
};

/**
 * The single Board → read-only view function. Both React (useSudoku)
 * and non-React callers (multiplayer progress reporting, future
 * analytics) project a Board through this one seam so the derivation
 * rules can't drift.
 */
export function projectBoard(
  board: Board,
  solution?: string | null,
): BoardProjection {
  const conflicts = getConflicts(board);
  const errors = solution ? getErrors(board, solution) : new Set<number>();
  const remainingCounts: Record<number, number> = {};
  for (let d = 1; d <= 9; d++) remainingCounts[d] = 9;
  let cellsRemaining = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell.value !== null && cell.value >= 1 && cell.value <= 9) {
        remainingCounts[cell.value]!--;
      } else {
        cellsRemaining++;
      }
    }
  }
  return { conflicts, errors, remainingCounts, cellsRemaining };
}

/**
 * Inverse of the `savedBoard` half of {@link initState}: project a live
 * Board back into the `SavedBoard` schema used by autosave. Pairing the
 * two keeps the `Board ↔ SavedBoard` round-trip owned by one module.
 */
export function serializeBoard(board: Board): SavedBoard {
  const values = board
    .flatMap((row) =>
      row.map((c) => (c.value === null ? "." : String(c.value))),
    )
    .join("");
  const notes = board.flatMap((row) => row.map((c) => Array.from(c.notes)));
  return { values, notes };
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
