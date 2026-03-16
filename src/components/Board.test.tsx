import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
});
