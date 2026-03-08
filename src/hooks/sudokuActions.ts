import { getConflicts, isBoardComplete } from "../lib/sudoku.ts";
import type { Board, ClearedNote, MoveAction, Position } from "../lib/types.ts";
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
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let i = 0; i < 9; i++) {
    if (i !== col && board[row]![i]!.notes.has(value)) {
      board[row]![i]!.notes.delete(value);
      clearedNotes.push({ row, col: i, note: value });
    }
    if (i !== row && board[i]![col]!.notes.has(value)) {
      board[i]![col]!.notes.delete(value);
      clearedNotes.push({ row: i, col, note: value });
    }
  }
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (r !== row && c !== col && board[r]![c]!.notes.has(value)) {
        board[r]![c]!.notes.delete(value);
        clearedNotes.push({ row: r, col: c, note: value });
      }
    }
  }
  return clearedNotes;
}

export function handlePlaceNumber(state: State, value: number): State {
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

  if (cell.isGiven) return state;

  if (state.notesMode) {
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

  const board = cloneBoard(state.board);
  board[row]![col]!.value = value;
  board[row]![col]!.notes = new Set();
  const clearedNotes = clearPeerNotes(board, row, col, value);
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

export function handleErase(state: State): State {
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
      activeHint: null,
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
    activeHint: null,
  };
}
