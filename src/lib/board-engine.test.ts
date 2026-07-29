// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  initState,
  projectBoard,
  reducer,
  serializeBoard,
} from "./board-engine.ts";
import { cellKey } from "./sudoku.ts";

describe("serializeBoard", () => {
  it("round-trips through initState", () => {
    const puzzle =
      "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
    const fresh = initState({ puzzle }).board;
    fresh[0]![2]!.value = 4;
    fresh[0]![3]!.notes = new Set([1, 2, 9]);
    fresh[8]![6]!.notes = new Set([3]);

    const saved = serializeBoard(fresh);
    const restored = initState({ puzzle, savedBoard: saved }).board;

    expect(serializeBoard(restored)).toEqual(saved);
    expect(restored[0]![2]!.value).toBe(4);
    expect([...restored[0]![3]!.notes].sort()).toEqual([1, 2, 9]);
    expect([...restored[8]![6]!.notes]).toEqual([3]);
  });

  it("encodes empty cells as '.' and preserves given cells", () => {
    const puzzle =
      "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
    const board = initState({ puzzle }).board;
    const { values } = serializeBoard(board);
    expect(values).toBe(puzzle);
  });
});

describe("structural sharing", () => {
  const puzzle =
    "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";

  it("preserves untouched row and cell identities across a placement", () => {
    // Cell is memoized, but a full-board clone gave all 81 cells fresh
    // identities on every keystroke — the memo never skipped anything.
    // Only the mutated cell (and its row array) may change identity.
    let state = initState({ puzzle });
    const before = state.board;
    state = reducer(state, { type: "SELECT_CELL", row: 0, col: 2 });
    state = reducer(state, {
      type: "PLACE_NUMBER",
      value: 4,
      autoEliminateNotes: false,
    });

    expect(state.board).not.toBe(before);
    expect(state.board[0]).not.toBe(before[0]);
    expect(state.board[0]![2]).not.toBe(before[0]![2]);
    // Untouched neighbours keep their identity.
    expect(state.board[0]![3]).toBe(before[0]![3]);
    expect(state.board[1]).toBe(before[1]);
    expect(state.board[8]).toBe(before[8]);
  });

  it("only touches the peer cells whose notes were auto-cleared", () => {
    let state = initState({ puzzle });
    state = reducer(state, { type: "SELECT_CELL", row: 0, col: 3 });
    state = reducer(state, {
      type: "PLACE_NUMBER",
      value: 4,
      autoEliminateNotes: true,
      asNote: true,
    });
    const before = state.board;
    state = reducer(state, { type: "SELECT_CELL", row: 0, col: 2 });
    state = reducer(state, {
      type: "PLACE_NUMBER",
      value: 4,
      autoEliminateNotes: true,
    });

    // (0,3) lost its pencil 4 → fresh identity; an unrelated far row
    // stays shared.
    expect(state.board[0]![3]).not.toBe(before[0]![3]);
    expect(state.board[5]).toBe(before[5]);
  });
});

describe("history bound", () => {
  const puzzle =
    "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";

  it("caps the undo history so long games don't grow it unboundedly", () => {
    let state = initState({ puzzle });
    // Drive 250 note-toggles in an empty cell. Without the cap, the
    // history would be 250 entries; with it, it stays at 100.
    state = reducer(state, { type: "SELECT_CELL", row: 0, col: 2 });
    for (let i = 0; i < 250; i++) {
      state = reducer(state, {
        type: "PLACE_NUMBER",
        value: (i % 9) + 1,
        autoEliminateNotes: false,
        asNote: true,
      });
    }
    expect(state.history.length).toBe(100);
  });
});

describe("RESET action", () => {
  const puzzleA =
    "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
  const puzzleB =
    "..9748...7........2.1.9.....7...24..64.1.59.8..98...3.....8.3.2........6...1879..";

  it("replaces the board with the new puzzle and clears history and selection", () => {
    let state = initState({ puzzle: puzzleA });
    state = reducer(state, { type: "SELECT_CELL", row: 0, col: 2 });
    state = reducer(state, {
      type: "PLACE_NUMBER",
      value: 4,
      autoEliminateNotes: false,
    });
    expect(state.history.length).toBe(1);
    expect(state.selectedCell).not.toBeNull();

    const next = reducer(state, {
      type: "RESET",
      puzzle: puzzleB,
      solution: undefined,
    });

    expect(next.history).toEqual([]);
    expect(next.selectedCell).toBeNull();
    expect(next.selectedCells.size).toBe(0);
    expect(next.status).toBe("playing");
    // First cell of puzzleB is empty ('.'); first cell of puzzleA was '5'.
    expect(next.board[0]![0]!.isGiven).toBe(false);
    expect(next.board[0]![0]!.value).toBeNull();
  });
});

describe("projectBoard", () => {
  const puzzle =
    "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";

  it("counts empty cells and remaining digits on an unmodified puzzle", () => {
    const board = initState({ puzzle }).board;
    const empties = puzzle.split("").filter((c) => c === ".").length;
    const projection = projectBoard(board);
    expect(projection.cellsRemaining).toBe(empties);
    // remainingCounts for each digit = 9 minus its givens
    for (let d = 1; d <= 9; d++) {
      const givens = puzzle.split("").filter((c) => c === String(d)).length;
      expect(projection.remainingCounts[d]).toBe(9 - givens);
    }
  });

  it("flags both cells of a row conflict", () => {
    const board = initState({ puzzle }).board;
    // Row 0 already has a 7; place another 7 elsewhere in row 0.
    board[0]![2]!.value = 7;
    const { conflicts } = projectBoard(board);
    expect(conflicts.has(cellKey(0, 2))).toBe(true);
    expect(conflicts.has(cellKey(0, 4))).toBe(true);
  });

  it("returns no errors when solution is omitted", () => {
    const board = initState({ puzzle }).board;
    board[0]![2]!.value = 9;
    expect(projectBoard(board).errors.size).toBe(0);
  });

  it("flags errors against a supplied solution", () => {
    const board = initState({ puzzle }).board;
    // Correct value at (0,2) is 4; insert wrong value 9.
    const solution =
      "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
    board[0]![2]!.value = 9;
    const { errors } = projectBoard(board, solution);
    expect(errors.has(cellKey(0, 2))).toBe(true);
  });
});

describe("PLACE_NOTE_AT action", () => {
  const puzzle =
    "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";

  it("toggles a note at an explicit cell with no cell selected", () => {
    let state = initState({ puzzle });
    state = reducer(state, {
      type: "PLACE_NOTE_AT",
      row: 0,
      col: 2,
      value: 4,
    });
    expect(state.board[0]![2]!.notes.has(4)).toBe(true);
  });

  it("leaves the selection untouched", () => {
    let state = initState({ puzzle });
    state = reducer(state, { type: "SELECT_CELL", row: 4, col: 4 });
    state = reducer(state, {
      type: "PLACE_NOTE_AT",
      row: 0,
      col: 2,
      value: 7,
    });
    expect(state.selectedCell).toEqual({ row: 4, col: 4 });
    expect(state.selectedCells).toEqual(new Set([cellKey(4, 4)]));
  });

  it("removes the note when the same value is placed twice", () => {
    let state = initState({ puzzle });
    state = reducer(state, { type: "PLACE_NOTE_AT", row: 0, col: 2, value: 4 });
    state = reducer(state, { type: "PLACE_NOTE_AT", row: 0, col: 2, value: 4 });
    expect(state.board[0]![2]!.notes.has(4)).toBe(false);
  });

  it("ignores given cells", () => {
    let state = initState({ puzzle });
    state = reducer(state, { type: "PLACE_NOTE_AT", row: 0, col: 0, value: 4 });
    expect(state.board[0]![0]!.notes.size).toBe(0);
    expect(state.history).toHaveLength(0);
  });

  it("ignores cells that already hold a value", () => {
    let state = initState({ puzzle });
    state = reducer(state, { type: "SELECT_CELL", row: 0, col: 2 });
    state = reducer(state, {
      type: "PLACE_NUMBER",
      value: 4,
      autoEliminateNotes: false,
    });
    state = reducer(state, { type: "PLACE_NOTE_AT", row: 0, col: 2, value: 9 });
    expect(state.board[0]![2]!.notes.size).toBe(0);
    expect(state.board[0]![2]!.value).toBe(4);
  });

  it("records history so the note can be undone", () => {
    let state = initState({ puzzle });
    state = reducer(state, { type: "PLACE_NOTE_AT", row: 0, col: 2, value: 4 });
    expect(state.history).toHaveLength(1);
    state = reducer(state, { type: "UNDO" });
    expect(state.board[0]![2]!.notes.has(4)).toBe(false);
    expect(state.history).toHaveLength(0);
  });
});

describe("PLACE_NUMBER overwrite protection", () => {
  const puzzle =
    "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";

  it("does not overwrite a non-given cell that already holds a value", () => {
    let state = initState({ puzzle });
    state = reducer(state, { type: "SELECT_CELL", row: 0, col: 2 });
    state = reducer(state, {
      type: "PLACE_NUMBER",
      value: 4,
      autoEliminateNotes: false,
    });
    expect(state.board[0]![2]!.value).toBe(4);

    const beforeSecond = state;
    state = reducer(state, {
      type: "PLACE_NUMBER",
      value: 9,
      autoEliminateNotes: false,
    });
    expect(state.board[0]![2]!.value).toBe(4);
    expect(state).toBe(beforeSecond);
    expect(state.history).toHaveLength(1);
  });
});
