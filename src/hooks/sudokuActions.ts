import { BOX_SIZE, GRID_SIZE } from "../lib/constants.ts";
import { getConflicts, isBoardComplete } from "../lib/sudoku.ts";
import type {
  Board,
  CellValue,
  ClearedNote,
  MoveAction,
  Position,
} from "../lib/types.ts";
import type { State } from "./sudokuReducer.ts";

export function cloneBoard(board: Board): Board {
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
  const clearedNotes: ClearedNote[] = [];
  const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
  const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;
  for (let i = 0; i < GRID_SIZE; i++) {
    if (i !== col && board[row]![i]!.notes.has(value)) {
      board[row]![i]!.notes.delete(value);
      clearedNotes.push({ row, col: i, note: value });
    }
    if (i !== row && board[i]![col]!.notes.has(value)) {
      board[i]![col]!.notes.delete(value);
      clearedNotes.push({ row: i, col, note: value });
    }
  }
  for (let r = boxRow; r < boxRow + BOX_SIZE; r++) {
    for (let c = boxCol; c < boxCol + BOX_SIZE; c++) {
      if (r !== row && c !== col && board[r]![c]!.notes.has(value)) {
        board[r]![c]!.notes.delete(value);
        clearedNotes.push({ row: r, col: c, note: value });
      }
    }
  }
  return clearedNotes;
}

/** Decode a cell key (row * GRID_SIZE + col) back to row, col. */
function fromCellKey(key: number): Position {
  return { row: Math.floor(key / GRID_SIZE), col: key % GRID_SIZE };
}

function handleBatchNoteToggle(
  state: State,
  value: number,
): State {
  const board = cloneBoard(state.board);
  const targets: Position[] = [];
  for (const key of state.selectedCells) {
    const { row, col } = fromCellKey(key);
    const target = board[row]![col]!;
    if (!target.isGiven && target.value === null) {
      targets.push({ row, col });
    }
  }
  if (targets.length === 0) return state;

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
    activeHint: null,
  };
}

function handleSingleNoteToggle(
  state: State,
  row: number,
  col: number,
  value: number,
): State {
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
    activeHint: null,
  };
}

function handleNumberPlacement(
  state: State,
  row: number,
  col: number,
  value: number,
  autoEliminateNotes: boolean,
): State {
  const cell = state.board[row]![col]!;
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
    activeHint: null,
  };
}

export function handlePlaceNumber(
  state: State,
  value: number,
  autoEliminateNotes = true,
): State {
  if (!state.selectedCell || state.status === "completed") return state;
  const { row, col } = state.selectedCell;
  const cell = state.board[row]![col]!;

  if (state.notesMode && state.selectedCells.size > 1) {
    return handleBatchNoteToggle(state, value);
  }
  if (cell.isGiven) return state;
  if (state.notesMode) {
    return handleSingleNoteToggle(state, row, col, value);
  }
  return handleNumberPlacement(state, row, col, value, autoEliminateNotes);
}

type ErasedCell = {
  position: Position;
  previousValue: CellValue;
  previousNotes: Set<number>;
};

function handleBatchErase(state: State): State {
  const board = cloneBoard(state.board);
  const erased: ErasedCell[] = [];
  for (const key of state.selectedCells) {
    const { row, col } = fromCellKey(key);
    const target = board[row]![col]!;
    if (!target.isGiven && (target.value !== null || target.notes.size > 0)) {
      erased.push({
        position: { row, col },
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
    activeHint: null,
  };
}

function handleSingleErase(state: State): State {
  const { row, col } = state.selectedCell!;
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
    activeHint: null,
  };
}

export function handleErase(state: State): State {
  if (!state.selectedCell || state.status === "completed") return state;

  if (state.selectedCells.size > 1) {
    return handleBatchErase(state);
  }
  return handleSingleErase(state);
}
