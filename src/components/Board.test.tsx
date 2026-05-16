import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cellKey } from "../lib/sudoku.ts";
import type { Board as BoardType, Cell } from "../lib/types.ts";
import { Board } from "./Board.tsx";

function emptyCell(value: number | null = null): Cell {
  return { value, isGiven: value !== null, notes: new Set() };
}

function makeBoard(overrides: [number, number, number][] = []): BoardType {
  const board: BoardType = Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => emptyCell()),
  );
  for (const [row, col, val] of overrides) {
    board[row]![col] = emptyCell(val);
  }
  return board;
}

describe("Board same-number row/col highlighting (full assist)", () => {
  it("highlights rows and columns of matching-number cells", () => {
    // Place a 5 at (1,2) and (4,6) — selecting (1,2)
    const board = makeBoard([
      [1, 2, 5],
      [4, 6, 5],
    ]);

    render(
      <Board
        board={board}
        selectedCell={{ row: 1, col: 2 }}
        conflicts={new Set()}
        onSelectCell={vi.fn()}
        assistLevel="full"
      />,
    );

    // Cell (4,0) is in row 4 (same row as matching 5 at (4,6)), not in selected row/col/box
    // It should get the match-row-col highlight
    const cell40 = screen.getByLabelText("Cell row 5 column 1, empty");
    expect(cell40.className).toContain("bg-cell-match-row-col");

    // Cell (0,6) is in col 6 (same col as matching 5 at (4,6)), not in selected row/col/box
    const cell06 = screen.getByLabelText("Cell row 1 column 7, empty");
    expect(cell06.className).toContain("bg-cell-match-row-col");
  });

  it("does not apply match-row-col highlight in standard assist", () => {
    const board = makeBoard([
      [1, 2, 5],
      [4, 6, 5],
    ]);

    render(
      <Board
        board={board}
        selectedCell={{ row: 1, col: 2 }}
        conflicts={new Set()}
        onSelectCell={vi.fn()}
        assistLevel="standard"
      />,
    );

    // Cell (4,0) should NOT have match-row-col in standard mode
    const cell40 = screen.getByLabelText("Cell row 5 column 1, empty");
    expect(cell40.className).not.toContain("bg-cell-match-row-col");
  });

  it("does not apply match-row-col highlight in paper assist", () => {
    const board = makeBoard([
      [1, 2, 5],
      [4, 6, 5],
    ]);

    render(
      <Board
        board={board}
        selectedCell={{ row: 1, col: 2 }}
        conflicts={new Set()}
        onSelectCell={vi.fn()}
        assistLevel="paper"
      />,
    );

    const cell40 = screen.getByLabelText("Cell row 5 column 1, empty");
    expect(cell40.className).not.toContain("bg-cell-match-row-col");
  });

  it("highlights cells in the same box as matching-number cells", () => {
    const board = makeBoard([
      [1, 2, 5],
      [4, 6, 5],
    ]);

    render(
      <Board
        board={board}
        selectedCell={{ row: 1, col: 2 }}
        conflicts={new Set()}
        onSelectCell={vi.fn()}
        assistLevel="full"
      />,
    );

    // (3,7) shares box (1,2) with matching 5 at (4,6); not in row 4 or col 6
    const cell37 = screen.getByLabelText("Cell row 4 column 8, empty");
    expect(cell37.className).toContain("bg-cell-match-row-col");
  });
});

describe("Board drag-select filters non-empty cells", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function findCell(row: number, col: number): HTMLElement {
    return document.querySelector(
      `[data-row="${row}"][data-col="${col}"]`,
    ) as HTMLElement;
  }

  function mockElementFromPoint(cells: Array<{ row: number; col: number }>) {
    // Map each successive (x, y) coordinate to the next cell in the list
    let idx = 0;
    const original = document.elementFromPoint;
    document.elementFromPoint = () => {
      const next = cells[Math.min(idx, cells.length - 1)]!;
      idx += 1;
      return findCell(next.row, next.col);
    };
    return () => {
      document.elementFromPoint = original;
    };
  }

  it("excludes given (non-empty) cells from drag-selection", () => {
    // Row 0: (0,0)=5 given, (0,1)=empty, (0,2)=empty, (0,3)=7 given, (0,4)=empty
    const board = makeBoard([
      [0, 0, 5],
      [0, 3, 7],
    ]);
    const onSetSelectedCells = vi.fn();

    render(
      <Board
        board={board}
        selectedCell={null}
        conflicts={new Set()}
        onSelectCell={vi.fn()}
        onSetSelectedCells={onSetSelectedCells}
      />,
    );

    mockElementFromPoint([
      { row: 0, col: 0 }, // pointerdown on given cell
      { row: 0, col: 1 }, // empty
      { row: 0, col: 2 }, // empty
      { row: 0, col: 3 }, // given
      { row: 0, col: 4 }, // empty
      { row: 0, col: 4 }, // pointerup
    ]);

    const region = screen.getByRole("region", { name: /sudoku board/i });
    fireEvent.pointerDown(region, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(region, { clientX: 1, clientY: 0 });
    fireEvent.pointerMove(region, { clientX: 2, clientY: 0 });
    fireEvent.pointerMove(region, { clientX: 3, clientY: 0 });
    fireEvent.pointerMove(region, { clientX: 4, clientY: 0 });
    fireEvent.pointerUp(region, { clientX: 4, clientY: 0 });

    expect(onSetSelectedCells).toHaveBeenCalled();
    const lastCall = onSetSelectedCells.mock.calls.at(-1)!;
    const selected = lastCall[0] as Set<number>;
    expect(selected.has(cellKey(0, 0))).toBe(false);
    expect(selected.has(cellKey(0, 3))).toBe(false);
    expect(selected.has(cellKey(0, 1))).toBe(true);
    expect(selected.has(cellKey(0, 2))).toBe(true);
    expect(selected.has(cellKey(0, 4))).toBe(true);
  });

  it("does not fire multi-selection when drag only crosses given cells", () => {
    // All cells in row 0 are given
    const board = makeBoard([
      [0, 0, 1],
      [0, 1, 2],
      [0, 2, 3],
    ]);
    const onSetSelectedCells = vi.fn();

    render(
      <Board
        board={board}
        selectedCell={null}
        conflicts={new Set()}
        onSelectCell={vi.fn()}
        onSetSelectedCells={onSetSelectedCells}
      />,
    );

    mockElementFromPoint([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 2 },
    ]);

    const region = screen.getByRole("region", { name: /sudoku board/i });
    fireEvent.pointerDown(region, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(region, { clientX: 1, clientY: 0 });
    fireEvent.pointerMove(region, { clientX: 2, clientY: 0 });
    fireEvent.pointerUp(region, { clientX: 2, clientY: 0 });

    expect(onSetSelectedCells).not.toHaveBeenCalled();
  });
});
