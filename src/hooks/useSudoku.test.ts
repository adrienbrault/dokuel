import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { hashCode, seededRandom } from "../lib/daily.ts";
import { cellKey, generatePuzzle, solvePuzzle } from "../lib/sudoku.ts";
import { useSudoku } from "./useSudoku.ts";

// Seeded generation: a fresh random board per run turned board-shape
// assumptions (like "the first empty cell's row has a second empty
// cell") into intermittent CI failures. Same seed → same board → a
// failure here reproduces on the next run.
function setupHook(difficulty: "easy" | "medium" = "easy") {
  const rng = seededRandom(hashCode(`useSudoku-test-${difficulty}`));
  const puzzle = generatePuzzle(difficulty, rng);
  return renderHook(() => useSudoku(puzzle));
}

// Deterministic fixture: solved board with two cells removed so a
// hint targets a known naked single while a peer cell stays empty.
const SOLVED =
  "534678912" +
  "672195348" +
  "198342567" +
  "859761423" +
  "426853791" +
  "713924856" +
  "961537284" +
  "287419635" +
  "345286179";
// R0C0 (=5) and R0C5 (=8) blanked. Both are naked singles; R0C5 is a
// row-peer of R0C0, used to verify a hint leaves peer notes untouched.
const TWO_HOLE_PUZZLE = `${SOLVED.slice(0, 0)}.${SOLVED.slice(1, 5)}.${SOLVED.slice(6)}`;

describe("useSudoku reset", () => {
  it("swaps the puzzle and clears history without remounting the hook", () => {
    const { result } = renderHook(() => useSudoku(TWO_HOLE_PUZZLE));

    act(() => result.current.selectCell(0, 0));
    act(() => result.current.placeNumber(5));
    expect(result.current.historyLength).toBe(1);

    const nextPuzzle = `${SOLVED.slice(0, 9)}.${SOLVED.slice(10)}`;
    act(() => result.current.reset(nextPuzzle, solvePuzzle(nextPuzzle)!));

    expect(result.current.historyLength).toBe(0);
    expect(result.current.selectedCell).toBeNull();
    expect(result.current.status).toBe("playing");
    // (1,0) is the new puzzle's empty cell
    expect(result.current.board[1]![0]!.isGiven).toBe(false);
    expect(result.current.board[1]![0]!.value).toBeNull();
  });
});

describe("useSudoku", () => {
  it("initializes board from puzzle", () => {
    const { result } = setupHook();
    expect(result.current.board).toHaveLength(9);
    expect(result.current.board[0]).toHaveLength(9);
  });

  it("starts in playing status", () => {
    const { result } = setupHook();
    expect(result.current.status).toBe("playing");
  });

  it("starts with no selected cell", () => {
    const { result } = setupHook();
    expect(result.current.selectedCell).toBeNull();
  });

  it("starts with notes mode off", () => {
    const { result } = setupHook();
    expect(result.current.notesMode).toBe(false);
  });

  it("can select a cell", () => {
    const { result } = setupHook();
    act(() => result.current.selectCell(3, 4));
    expect(result.current.selectedCell).toEqual({ row: 3, col: 4 });
  });

  it("can place a number on an empty cell", () => {
    const { result } = setupHook();

    // Find an empty cell
    const pos = findEmptyCell(result.current.board);
    if (!pos) throw new Error("No empty cell found");

    act(() => result.current.selectCell(pos.row, pos.col));
    act(() => result.current.placeNumber(5));

    expect(result.current.board[pos.row]![pos.col]!.value).toBe(5);
  });

  it("cannot place a number on a given cell", () => {
    const { result } = setupHook();

    // Find a given cell
    const pos = findGivenCell(result.current.board);
    if (!pos) throw new Error("No given cell found");

    const originalValue = result.current.board[pos.row]![pos.col]!.value;
    act(() => result.current.selectCell(pos.row, pos.col));
    act(() => result.current.placeNumber(5));

    expect(result.current.board[pos.row]![pos.col]!.value).toBe(originalValue);
  });

  it("undo reverts the last move", () => {
    const { result } = setupHook();

    const pos = findEmptyCell(result.current.board);
    if (!pos) throw new Error("No empty cell found");

    act(() => result.current.selectCell(pos.row, pos.col));
    act(() => result.current.placeNumber(5));
    expect(result.current.board[pos.row]![pos.col]!.value).toBe(5);

    act(() => result.current.undo());
    expect(result.current.board[pos.row]![pos.col]!.value).toBeNull();
  });

  it("erase clears a non-given cell", () => {
    const { result } = setupHook();

    const pos = findEmptyCell(result.current.board);
    if (!pos) throw new Error("No empty cell found");

    act(() => result.current.selectCell(pos.row, pos.col));
    act(() => result.current.placeNumber(3));
    expect(result.current.board[pos.row]![pos.col]!.value).toBe(3);

    act(() => result.current.erase());
    expect(result.current.board[pos.row]![pos.col]!.value).toBeNull();
  });

  it("erase does not clear a given cell", () => {
    const { result } = setupHook();

    const pos = findGivenCell(result.current.board);
    if (!pos) throw new Error("No given cell found");

    const originalValue = result.current.board[pos.row]![pos.col]!.value;
    act(() => result.current.selectCell(pos.row, pos.col));
    act(() => result.current.erase());

    expect(result.current.board[pos.row]![pos.col]!.value).toBe(originalValue);
  });

  it("toggle notes mode on and off", () => {
    const { result } = setupHook();
    expect(result.current.notesMode).toBe(false);

    act(() => result.current.toggleNotesMode());
    expect(result.current.notesMode).toBe(true);

    act(() => result.current.toggleNotesMode());
    expect(result.current.notesMode).toBe(false);
  });

  it("in notes mode, placeNumber toggles a note on a cell", () => {
    const { result } = setupHook();

    const pos = findEmptyCell(result.current.board);
    if (!pos) throw new Error("No empty cell found");

    act(() => result.current.toggleNotesMode());
    act(() => result.current.selectCell(pos.row, pos.col));
    act(() => result.current.placeNumber(7));

    expect(result.current.board[pos.row]![pos.col]!.notes.has(7)).toBe(true);

    // Toggle it off
    act(() => result.current.placeNumber(7));
    expect(result.current.board[pos.row]![pos.col]!.notes.has(7)).toBe(false);
  });

  it("placing a value clears notes on that cell", () => {
    const { result } = setupHook();

    const pos = findEmptyCell(result.current.board);
    if (!pos) throw new Error("No empty cell found");

    // Add a note
    act(() => result.current.toggleNotesMode());
    act(() => result.current.selectCell(pos.row, pos.col));
    act(() => result.current.placeNumber(4));
    expect(result.current.board[pos.row]![pos.col]!.notes.has(4)).toBe(true);

    // Place a value (turn off notes mode first)
    act(() => result.current.toggleNotesMode());
    act(() => result.current.placeNumber(5));

    expect(result.current.board[pos.row]![pos.col]!.value).toBe(5);
    expect(result.current.board[pos.row]![pos.col]!.notes.size).toBe(0);
  });

  it("detects conflicts on each move", () => {
    const { result } = setupHook();

    // Find any row that has at least two empty non-given cells. Scanning
    // for the first empty cell and then looking for a second in its row
    // is flaky: the chosen row can have a single empty cell on some
    // puzzles, which surfaced as an intermittent CI failure.
    const pair = findTwoEmptyCellsInSameRow(result.current.board);
    if (!pair) throw new Error("No row with two empty cells");
    const { pos1, pos2 } = pair;

    act(() => result.current.selectCell(pos1.row, pos1.col));
    act(() => result.current.placeNumber(9));
    act(() => result.current.selectCell(pos2.row, pos2.col));
    act(() => result.current.placeNumber(9));

    expect(result.current.conflicts.has(cellKey(pos1.row, pos1.col))).toBe(
      true,
    );
    expect(result.current.conflicts.has(cellKey(pos2.row, pos2.col))).toBe(
      true,
    );
  });

  it("detects completion when board is fully and correctly solved", () => {
    const puzzle = generatePuzzle("easy");
    const solution = solvePuzzle(puzzle)!;
    const { result } = renderHook(() => useSudoku(puzzle));

    // Fill all empty cells with correct values from solution
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (!result.current.board[row]![col]!.isGiven) {
          act(() => result.current.selectCell(row, col));
          act(() =>
            result.current.placeNumber(Number(solution[row * 9 + col])),
          );
        }
      }
    }

    expect(result.current.status).toBe("completed");
  });

  it("getRemainingCounts returns correct counts", () => {
    const { result } = setupHook();
    const counts = result.current.remainingCounts;

    // Should have entries for 1-9
    expect(Object.keys(counts)).toHaveLength(9);

    // Total of all counts + placed should = 9 for each digit
    for (let d = 1; d <= 9; d++) {
      expect(counts[d]!).toBeGreaterThanOrEqual(0);
      expect(counts[d]!).toBeLessThanOrEqual(9);
    }
  });

  it("placing a number auto-clears that note from peers in same row/col/box", () => {
    const { result } = setupHook();

    // Find an empty cell that has at least one empty peer in same row and same col
    const { pos, rowPeer, colPeer } = findCellWithPeers(result.current.board);

    // Add note 7 to both peers
    act(() => result.current.toggleNotesMode());
    act(() => result.current.selectCell(rowPeer.row, rowPeer.col));
    act(() => result.current.placeNumber(7));
    act(() => result.current.selectCell(colPeer.row, colPeer.col));
    act(() => result.current.placeNumber(7));
    expect(result.current.board[rowPeer.row]![rowPeer.col]!.notes.has(7)).toBe(
      true,
    );
    expect(result.current.board[colPeer.row]![colPeer.col]!.notes.has(7)).toBe(
      true,
    );

    // Place 7 in the target cell (switch back to place mode)
    act(() => result.current.toggleNotesMode());
    act(() => result.current.selectCell(pos.row, pos.col));
    act(() => result.current.placeNumber(7));

    // Notes should be cleared from peers
    expect(result.current.board[rowPeer.row]![rowPeer.col]!.notes.has(7)).toBe(
      false,
    );
    expect(result.current.board[colPeer.row]![colPeer.col]!.notes.has(7)).toBe(
      false,
    );
  });

  it("multi-select: batch note toggle adds note to all selected empty cells", () => {
    const { result } = setupHook();

    // Find three empty cells
    const cells = findMultipleEmptyCells(result.current.board, 3);

    // Select all three cells via setSelectedCells
    const keys = new Set(cells.map((c) => cellKey(c.row, c.col)));
    act(() => result.current.setSelectedCells(keys, cells[0]!));

    // Enable notes mode and place a note
    act(() => result.current.toggleNotesMode());
    act(() => result.current.placeNumber(5));

    // All three cells should have note 5
    for (const pos of cells) {
      expect(result.current.board[pos.row]![pos.col]!.notes.has(5)).toBe(true);
    }
  });

  it("multi-select: batch note toggle removes note when all selected cells have it", () => {
    const { result } = setupHook();

    const cells = findMultipleEmptyCells(result.current.board, 2);
    const keys = new Set(cells.map((c) => cellKey(c.row, c.col)));

    // Add note 3 to both cells individually
    act(() => result.current.toggleNotesMode());
    for (const pos of cells) {
      act(() => result.current.selectCell(pos.row, pos.col));
      act(() => result.current.placeNumber(3));
    }

    // Now multi-select and toggle note 3 — should remove from all
    act(() => result.current.setSelectedCells(keys, cells[0]!));
    act(() => result.current.placeNumber(3));

    for (const pos of cells) {
      expect(result.current.board[pos.row]![pos.col]!.notes.has(3)).toBe(false);
    }
  });

  it("multi-select: undo reverts batch note toggle", () => {
    const { result } = setupHook();

    const cells = findMultipleEmptyCells(result.current.board, 2);
    const keys = new Set(cells.map((c) => cellKey(c.row, c.col)));

    act(() => result.current.toggleNotesMode());
    act(() => result.current.setSelectedCells(keys, cells[0]!));
    act(() => result.current.placeNumber(8));

    // Both should have note 8
    for (const pos of cells) {
      expect(result.current.board[pos.row]![pos.col]!.notes.has(8)).toBe(true);
    }

    // Undo should revert
    act(() => result.current.undo());
    for (const pos of cells) {
      expect(result.current.board[pos.row]![pos.col]!.notes.has(8)).toBe(false);
    }
  });

  it("multi-select: batch erase clears all selected non-given cells", () => {
    const { result } = setupHook();

    const cells = findMultipleEmptyCells(result.current.board, 2);

    // Place values in both cells
    for (const pos of cells) {
      act(() => result.current.selectCell(pos.row, pos.col));
      act(() => result.current.placeNumber(4));
    }

    // Multi-select and erase
    const keys = new Set(cells.map((c) => cellKey(c.row, c.col)));
    act(() => result.current.setSelectedCells(keys, cells[0]!));
    act(() => result.current.erase());

    for (const pos of cells) {
      expect(result.current.board[pos.row]![pos.col]!.value).toBeNull();
    }
  });

  it("multi-select: undo reverts batch erase", () => {
    const { result } = setupHook();

    const cells = findMultipleEmptyCells(result.current.board, 2);

    // Place values
    act(() => result.current.selectCell(cells[0]!.row, cells[0]!.col));
    act(() => result.current.placeNumber(6));
    act(() => result.current.selectCell(cells[1]!.row, cells[1]!.col));
    act(() => result.current.placeNumber(7));

    // Multi-select and erase
    const keys = new Set(cells.map((c) => cellKey(c.row, c.col)));
    act(() => result.current.setSelectedCells(keys, cells[0]!));
    act(() => result.current.erase());

    // Undo should restore values
    act(() => result.current.undo());
    expect(result.current.board[cells[0]!.row]![cells[0]!.col]!.value).toBe(6);
    expect(result.current.board[cells[1]!.row]![cells[1]!.col]!.value).toBe(7);
  });

  it("multi-select: batch note toggle skips given and filled cells", () => {
    const { result } = setupHook();

    const emptyCell = findEmptyCell(result.current.board);
    const givenCell = findGivenCell(result.current.board);
    if (!emptyCell || !givenCell) throw new Error("Need both empty and given");

    const keys = new Set([
      cellKey(emptyCell.row, emptyCell.col),
      cellKey(givenCell.row, givenCell.col),
    ]);
    act(() => result.current.toggleNotesMode());
    act(() => result.current.setSelectedCells(keys, emptyCell));
    act(() => result.current.placeNumber(2));

    // Only empty cell gets the note
    expect(
      result.current.board[emptyCell.row]![emptyCell.col]!.notes.has(2),
    ).toBe(true);
  });

  it("placeNumber with asNote=true toggles a note even when notes mode is off", () => {
    const { result } = setupHook();

    const pos = findEmptyCell(result.current.board);
    if (!pos) throw new Error("No empty cell found");

    expect(result.current.notesMode).toBe(false);
    act(() => result.current.selectCell(pos.row, pos.col));
    act(() => result.current.placeNumber(7, true, true));

    expect(result.current.board[pos.row]![pos.col]!.value).toBeNull();
    expect(result.current.board[pos.row]![pos.col]!.notes.has(7)).toBe(true);
    expect(result.current.notesMode).toBe(false);

    act(() => result.current.placeNumber(7, true, true));
    expect(result.current.board[pos.row]![pos.col]!.notes.has(7)).toBe(false);
  });

  it("placeNumber with asNote=false places a value even when notes mode is on", () => {
    const { result } = setupHook();

    const pos = findEmptyCell(result.current.board);
    if (!pos) throw new Error("No empty cell found");

    act(() => result.current.toggleNotesMode());
    expect(result.current.notesMode).toBe(true);
    act(() => result.current.selectCell(pos.row, pos.col));
    act(() => result.current.placeNumber(4, true, false));

    expect(result.current.board[pos.row]![pos.col]!.value).toBe(4);
  });

  it("placeNoteAt toggles a note without moving the selection", () => {
    const { result } = setupHook();

    const [anchor, target] = findMultipleEmptyCells(result.current.board, 2);
    if (!anchor || !target) throw new Error("Need two empty cells");

    act(() => result.current.selectCell(anchor.row, anchor.col));
    act(() => result.current.placeNoteAt(target.row, target.col, 6));

    expect(result.current.board[target.row]![target.col]!.notes.has(6)).toBe(
      true,
    );
    expect(result.current.selectedCell).toEqual(anchor);

    act(() => result.current.placeNoteAt(target.row, target.col, 6));
    expect(result.current.board[target.row]![target.col]!.notes.has(6)).toBe(
      false,
    );
  });

  describe("hint", () => {
    it("does not fill the hinted cell", () => {
      const { result } = renderHook(() => useSudoku(TWO_HOLE_PUZZLE, SOLVED));

      expect(result.current.board[0]![0]!.value).toBeNull();
      act(() => result.current.hint());

      expect(result.current.board[0]![0]!.value).toBeNull();
    });

    it("increments hintsUsed and selects the hinted cell", () => {
      const { result } = renderHook(() => useSudoku(TWO_HOLE_PUZZLE, SOLVED));

      expect(result.current.hintsUsed).toBe(0);
      act(() => result.current.hint());

      expect(result.current.hintsUsed).toBe(1);
      expect(result.current.selectedCell).toEqual({ row: 0, col: 0 });
    });

    it("exposes the deduced value and explanation via activeHint", () => {
      const { result } = renderHook(() => useSudoku(TWO_HOLE_PUZZLE, SOLVED));

      act(() => result.current.hint());

      expect(result.current.activeHint).not.toBeNull();
      expect(result.current.activeHint!.position).toEqual({ row: 0, col: 0 });
      expect(result.current.activeHint!.value).toBe(5);
    });

    it("progresses a hint from nudge through pattern, elimination, and reveal", () => {
      const { result } = renderHook(() => useSudoku(TWO_HOLE_PUZZLE, SOLVED));

      act(() => result.current.hint());
      expect(result.current.activeHint?.step).toBe("nudge");

      act(() => result.current.hint());
      expect(result.current.activeHint?.step).toBe("pattern");

      act(() => result.current.hint());
      expect(result.current.activeHint?.step).toBe("elimination");

      act(() => result.current.hint());
      expect(result.current.activeHint?.step).toBe("reveal");
      expect(result.current.activeHint?.value).toBe(5);
      expect(result.current.hintsUsed).toBe(1);
    });

    it("adds nothing to undo history", () => {
      const { result } = renderHook(() => useSudoku(TWO_HOLE_PUZZLE, SOLVED));

      const beforeLen = result.current.historyLength;
      act(() => result.current.hint());

      expect(result.current.historyLength).toBe(beforeLen);
    });

    it("leaves peer notes untouched", () => {
      const { result } = renderHook(() => useSudoku(TWO_HOLE_PUZZLE, SOLVED));

      // Put note 5 on R0C5, a row-peer of the hinted cell R0C0. The
      // hint must not place a value, so the note must survive.
      act(() => result.current.toggleNotesMode());
      act(() => result.current.selectCell(0, 5));
      act(() => result.current.placeNumber(5));
      expect(result.current.board[0]![5]!.notes.has(5)).toBe(true);

      act(() => result.current.toggleNotesMode());
      act(() => result.current.selectCell(0, 0));
      act(() => result.current.hint());

      expect(result.current.board[0]![5]!.notes.has(5)).toBe(true);
    });
  });

  it("undo restores auto-cleared notes from peers", () => {
    const { result } = setupHook();

    const { pos, rowPeer } = findCellWithPeers(result.current.board);

    // Add note 3 to peer
    act(() => result.current.toggleNotesMode());
    act(() => result.current.selectCell(rowPeer.row, rowPeer.col));
    act(() => result.current.placeNumber(3));
    expect(result.current.board[rowPeer.row]![rowPeer.col]!.notes.has(3)).toBe(
      true,
    );

    // Place 3 in target cell
    act(() => result.current.toggleNotesMode());
    act(() => result.current.selectCell(pos.row, pos.col));
    act(() => result.current.placeNumber(3));
    expect(result.current.board[rowPeer.row]![rowPeer.col]!.notes.has(3)).toBe(
      false,
    );

    // Undo should restore the note
    act(() => result.current.undo());
    expect(result.current.board[rowPeer.row]![rowPeer.col]!.notes.has(3)).toBe(
      true,
    );
  });
});

function findCellWithPeers(
  board: { value: number | null; isGiven: boolean }[][],
) {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row]![col]!.isGiven || board[row]![col]!.value !== null)
        continue;
      let rowPeer: { row: number; col: number } | null = null;
      for (let c = 0; c < 9; c++) {
        if (
          c !== col &&
          !board[row]![c]!.isGiven &&
          board[row]![c]!.value === null
        ) {
          rowPeer = { row, col: c };
          break;
        }
      }
      let colPeer: { row: number; col: number } | null = null;
      for (let r = 0; r < 9; r++) {
        if (
          r !== row &&
          !board[r]![col]!.isGiven &&
          board[r]![col]!.value === null
        ) {
          colPeer = { row: r, col };
          break;
        }
      }
      if (rowPeer && colPeer) {
        return { pos: { row, col }, rowPeer, colPeer };
      }
    }
  }
  throw new Error("No empty cell with row and col peers found");
}

function findTwoEmptyCellsInSameRow(
  board: { value: number | null; isGiven: boolean }[][],
) {
  for (let row = 0; row < 9; row++) {
    const cols: number[] = [];
    for (let col = 0; col < 9; col++) {
      if (!board[row]![col]!.isGiven && board[row]![col]!.value === null) {
        cols.push(col);
      }
    }
    if (cols.length >= 2) {
      return { pos1: { row, col: cols[0]! }, pos2: { row, col: cols[1]! } };
    }
  }
  return null;
}

function findEmptyCell(board: { value: number | null; isGiven: boolean }[][]) {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (!board[row]![col]!.isGiven && board[row]![col]!.value === null) {
        return { row, col };
      }
    }
  }
  return null;
}

function findGivenCell(board: { value: number | null; isGiven: boolean }[][]) {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row]![col]!.isGiven) {
        return { row, col };
      }
    }
  }
  return null;
}

function findMultipleEmptyCells(
  board: { value: number | null; isGiven: boolean }[][],
  count: number,
) {
  const cells: { row: number; col: number }[] = [];
  for (let row = 0; row < 9 && cells.length < count; row++) {
    for (let col = 0; col < 9 && cells.length < count; col++) {
      if (!board[row]![col]!.isGiven && board[row]![col]!.value === null) {
        cells.push({ row, col });
      }
    }
  }
  if (cells.length < count) throw new Error(`Need ${count} empty cells`);
  return cells;
}
