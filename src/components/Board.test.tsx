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
    const cell40 = screen.getByLabelText(/^Cell row 5 column 1, empty/);
    expect(cell40.className).toContain("bg-cell-match-row-col");

    // Cell (0,6) is in col 6 (same col as matching 5 at (4,6)), not in selected row/col/box
    const cell06 = screen.getByLabelText(/^Cell row 1 column 7, empty/);
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
    const cell40 = screen.getByLabelText(/^Cell row 5 column 1, empty/);
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

    const cell40 = screen.getByLabelText(/^Cell row 5 column 1, empty/);
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
    const cell37 = screen.getByLabelText(/^Cell row 4 column 8, empty/);
    expect(cell37.className).toContain("bg-cell-match-row-col");
  });
});

describe("Board highlightedDigit", () => {
  it("highlights cells matching highlightedDigit when no cell selected", () => {
    // Place 7s at (0,0), (3,3), (5,8); other cells empty
    const board = makeBoard([
      [0, 0, 7],
      [3, 3, 7],
      [5, 8, 7],
      [4, 4, 2],
    ]);

    render(
      <Board
        board={board}
        selectedCell={null}
        highlightedDigit={7}
        conflicts={new Set()}
        onSelectCell={vi.fn()}
      />,
    );

    expect(
      screen.getByLabelText(/^Cell row 1 column 1, value 7/).className,
    ).toContain("bg-cell-same-number");
    expect(
      screen.getByLabelText(/^Cell row 4 column 4, value 7/).className,
    ).toContain("bg-cell-same-number");
    expect(
      screen.getByLabelText(/^Cell row 6 column 9, value 7/).className,
    ).toContain("bg-cell-same-number");
    // Non-matching value cell does not get same-number bg
    expect(
      screen.getByLabelText(/^Cell row 5 column 5, value 2/).className,
    ).not.toContain("bg-cell-same-number");
  });

  it("ignores highlightedDigit when a cell is selected", () => {
    // Selected cell at (0,0)=5, with 7s elsewhere and highlightedDigit=7
    const board = makeBoard([
      [0, 0, 5],
      [3, 3, 7],
    ]);

    render(
      <Board
        board={board}
        selectedCell={{ row: 0, col: 0 }}
        highlightedDigit={7}
        conflicts={new Set()}
        onSelectCell={vi.fn()}
      />,
    );

    // The 7 at (3,3) should NOT highlight as same-number because the
    // selected cell's value (5) takes precedence
    expect(
      screen.getByLabelText(/^Cell row 4 column 4, value 7/).className,
    ).not.toContain("bg-cell-same-number");
  });

  it("highlights row/col/box of highlightedDigit cells in full assist with no cell selected", () => {
    // Mirrors the numpad-filter path: in full assist, hovering/dragging a
    // digit on the numpad should show the same "where the digit can't go"
    // row/col/box halo that a cell selection produces.
    const board = makeBoard([
      [1, 2, 5],
      [4, 6, 5],
    ]);

    render(
      <Board
        board={board}
        selectedCell={null}
        highlightedDigit={5}
        conflicts={new Set()}
        onSelectCell={vi.fn()}
        assistLevel="full"
      />,
    );

    // Cell (1,0) shares row 1 with the 5 at (1,2)
    const cell10 = screen.getByLabelText(/^Cell row 2 column 1, empty/);
    expect(cell10.className).toContain("bg-cell-match-row-col");

    // Cell (0,6) shares col 6 with the 5 at (4,6)
    const cell06 = screen.getByLabelText(/^Cell row 1 column 7, empty/);
    expect(cell06.className).toContain("bg-cell-match-row-col");

    // Cell (3,7) shares box (1,2) with the 5 at (4,6)
    const cell37 = screen.getByLabelText(/^Cell row 4 column 8, empty/);
    expect(cell37.className).toContain("bg-cell-match-row-col");
  });

  it("does not apply digit-highlight row/col/box halo outside full assist", () => {
    const board = makeBoard([
      [1, 2, 5],
      [4, 6, 5],
    ]);

    render(
      <Board
        board={board}
        selectedCell={null}
        highlightedDigit={5}
        conflicts={new Set()}
        onSelectCell={vi.fn()}
        assistLevel="standard"
      />,
    );

    const cell10 = screen.getByLabelText(/^Cell row 2 column 1, empty/);
    expect(cell10.className).not.toContain("bg-cell-match-row-col");
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
    // Map each successive (x, y) coordinate to the next cell in the list.
    // A spy (not a raw assignment) so restoreMocks cleans up even when
    // an assertion fails before the test's own restore call.
    let idx = 0;
    const spy = vi
      .spyOn(document, "elementFromPoint")
      .mockImplementation(() => {
        const next = cells[Math.min(idx, cells.length - 1)]!;
        idx += 1;
        return findCell(next.row, next.col);
      });
    return () => {
      spy.mockRestore();
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

describe("Board iOS back-swipe suppression", () => {
  it("prevents default on touchstart so iOS Safari can't hijack edge drags as the back gesture", () => {
    // touch-action: none isn't sufficient — iOS Safari's swipe-from-edge
    // back gesture often ignores it. A non-passive touchstart listener
    // calling preventDefault is the universally reliable block.
    const board = makeBoard([[0, 0, 5]]);
    render(
      <Board
        board={board}
        selectedCell={null}
        conflicts={new Set()}
        onSelectCell={vi.fn()}
      />,
    );

    const region = screen.getByRole("region", { name: /sudoku board/i });
    const event = new Event("touchstart", { bubbles: true, cancelable: true });
    region.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("fires onSelectCell on a touch tap so taps still select after touchstart preventDefault", () => {
    // preventDefault on touchstart also suppresses iOS's synthesized
    // click, so the Cell.onClick path can't be relied on for touch
    // taps. The drag-select hook fires selection from pointerup to
    // cover this — only for pointerType "touch" to avoid double-firing
    // alongside the desktop click event.
    const board = makeBoard([[0, 0, 5]]);
    const onSelectCell = vi.fn();
    const onSetSelectedCells = vi.fn();

    render(
      <Board
        board={board}
        selectedCell={null}
        conflicts={new Set()}
        onSelectCell={onSelectCell}
        onSetSelectedCells={onSetSelectedCells}
      />,
    );

    const findCell = (row: number, col: number): HTMLElement =>
      document.querySelector(
        `[data-row="${row}"][data-col="${col}"]`,
      ) as HTMLElement;
    vi.spyOn(document, "elementFromPoint").mockImplementation(() =>
      findCell(0, 0),
    );

    const region = screen.getByRole("region", { name: /sudoku board/i });
    fireEvent.pointerDown(region, {
      clientX: 5,
      clientY: 100,
      pointerId: 1,
      pointerType: "touch",
    });
    fireEvent.pointerUp(region, {
      clientX: 5,
      clientY: 100,
      pointerId: 1,
      pointerType: "touch",
    });

    expect(onSelectCell).toHaveBeenCalledWith(0, 0);
  });

  it("restores tap-to-select for pen input too", () => {
    // Apple Pencil taps fire touch events (so the Board's touchstart
    // preventDefault suppresses the synthesized click) but report
    // pointerType "pen" — a touch-only recovery leaves Pencil users
    // unable to select cells at all.
    const board = makeBoard([[0, 0, 5]]);
    const onSelectCell = vi.fn();
    const onSetSelectedCells = vi.fn();

    render(
      <Board
        board={board}
        selectedCell={null}
        conflicts={new Set()}
        onSelectCell={onSelectCell}
        onSetSelectedCells={onSetSelectedCells}
      />,
    );

    const findCell = (row: number, col: number): HTMLElement =>
      document.querySelector(
        `[data-row="${row}"][data-col="${col}"]`,
      ) as HTMLElement;
    vi.spyOn(document, "elementFromPoint").mockImplementation(() =>
      findCell(0, 0),
    );

    const region = screen.getByRole("region", { name: /sudoku board/i });
    fireEvent.pointerDown(region, {
      clientX: 5,
      clientY: 100,
      pointerId: 1,
      pointerType: "pen",
    });
    fireEvent.pointerUp(region, {
      clientX: 5,
      clientY: 100,
      pointerId: 1,
      pointerType: "pen",
    });

    expect(onSelectCell).toHaveBeenCalledWith(0, 0);
  });

  it("does not double-fire onSelectCell from pointerup on a mouse click", () => {
    // Desktop mouse already fires Cell.onClick from the synthesized
    // click event — the pointerup path is only for touch where click
    // is suppressed. Pointer type "mouse" must skip it.
    const board = makeBoard([[0, 0, 5]]);
    const onSelectCell = vi.fn();
    const onSetSelectedCells = vi.fn();

    render(
      <Board
        board={board}
        selectedCell={null}
        conflicts={new Set()}
        onSelectCell={onSelectCell}
        onSetSelectedCells={onSetSelectedCells}
      />,
    );

    const findCell = (row: number, col: number): HTMLElement =>
      document.querySelector(
        `[data-row="${row}"][data-col="${col}"]`,
      ) as HTMLElement;
    vi.spyOn(document, "elementFromPoint").mockImplementation(() =>
      findCell(0, 0),
    );

    const region = screen.getByRole("region", { name: /sudoku board/i });
    fireEvent.pointerDown(region, {
      clientX: 5,
      clientY: 100,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.pointerUp(region, {
      clientX: 5,
      clientY: 100,
      pointerId: 1,
      pointerType: "mouse",
    });

    expect(onSelectCell).not.toHaveBeenCalled();
  });
});

describe("Board filled-cell drag gating", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function findCell(row: number, col: number): HTMLElement {
    return document.querySelector(
      `[data-row="${row}"][data-col="${col}"]`,
    ) as HTMLElement;
  }

  function mockElementFromPoint(cells: Array<{ row: number; col: number }>) {
    let idx = 0;
    const spy = vi
      .spyOn(document, "elementFromPoint")
      .mockImplementation(() => {
        const next = cells[Math.min(idx, cells.length - 1)]!;
        idx += 1;
        return findCell(next.row, next.col);
      });
    return () => {
      spy.mockRestore();
    };
  }

  it("does not start cell drag on quick tap with finger wobble of a filled cell", () => {
    // Real-world bug: a quick tap with ~7px finger wobble on a filled cell
    // was tripping the cell-drag handover, suppressing the click and
    // leaving the cell unselected.
    const board = makeBoard([[0, 0, 5]]);
    const onStartCellDrag = vi.fn();
    const onSetSelectedCells = vi.fn();

    render(
      <Board
        board={board}
        selectedCell={null}
        conflicts={new Set()}
        onSelectCell={vi.fn()}
        onSetSelectedCells={onSetSelectedCells}
        onStartCellDrag={onStartCellDrag}
      />,
    );

    mockElementFromPoint([
      { row: 0, col: 0 },
      { row: 0, col: 0 },
      { row: 0, col: 0 },
    ]);

    const region = screen.getByRole("region", { name: /sudoku board/i });
    fireEvent.pointerDown(region, {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    });
    // 7px wobble — below the old 6px threshold's intent but above it numerically
    fireEvent.pointerMove(region, {
      clientX: 107,
      clientY: 100,
      pointerId: 1,
    });
    fireEvent.pointerUp(region, { clientX: 107, clientY: 100, pointerId: 1 });

    expect(onStartCellDrag).not.toHaveBeenCalled();
  });

  it("starts cell drag immediately when a quick swipe crosses into a different cell", () => {
    // The previous design rejected a hold-timer specifically because a
    // quick digit-drag swipe felt laggy. Cell-crossing must still
    // activate the drag without waiting on the hold window.
    const board = makeBoard([[0, 0, 5]]);
    const onStartCellDrag = vi.fn();
    const onSetSelectedCells = vi.fn();

    render(
      <Board
        board={board}
        selectedCell={null}
        conflicts={new Set()}
        onSelectCell={vi.fn()}
        onSetSelectedCells={onSetSelectedCells}
        onStartCellDrag={onStartCellDrag}
      />,
    );

    mockElementFromPoint([
      { row: 0, col: 0 }, // pointerdown
      { row: 0, col: 1 }, // pointermove crosses cells immediately
    ]);

    const region = screen.getByRole("region", { name: /sudoku board/i });
    fireEvent.pointerDown(region, {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    });
    fireEvent.pointerMove(region, {
      clientX: 140,
      clientY: 100,
      pointerId: 1,
    });

    expect(onStartCellDrag).toHaveBeenCalledTimes(1);
  });

  it("starts cell drag when the press is held long enough then moved", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const board = makeBoard([[0, 0, 5]]);
    const onStartCellDrag = vi.fn();
    const onSetSelectedCells = vi.fn();

    render(
      <Board
        board={board}
        selectedCell={null}
        conflicts={new Set()}
        onSelectCell={vi.fn()}
        onSetSelectedCells={onSetSelectedCells}
        onStartCellDrag={onStartCellDrag}
      />,
    );

    mockElementFromPoint([
      { row: 0, col: 0 },
      { row: 0, col: 0 },
    ]);

    const region = screen.getByRole("region", { name: /sudoku board/i });
    fireEvent.pointerDown(region, {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    });
    vi.setSystemTime(250);
    fireEvent.pointerMove(region, {
      clientX: 120,
      clientY: 100,
      pointerId: 1,
    });

    expect(onStartCellDrag).toHaveBeenCalledTimes(1);
    expect(onStartCellDrag.mock.calls[0]![0]).toMatchObject({
      digit: 5,
      from: { row: 0, col: 0 },
    });
  });

  it("does not poison the next tap when a prior drag's trailing click was skipped", () => {
    // iOS Safari does not synthesize a click event after a touch that
    // moved significantly — true of every digit drag. The suppress-click
    // flag set when the drag activated would then have no click to
    // consume it, silently eating the user's next tap on a given cell.
    const board = makeBoard([
      [0, 0, 5],
      [3, 3, 7],
    ]);
    const onSelectCell = vi.fn();
    const onStartCellDrag = vi.fn();
    const onSetSelectedCells = vi.fn();

    render(
      <Board
        board={board}
        selectedCell={null}
        conflicts={new Set()}
        onSelectCell={onSelectCell}
        onSetSelectedCells={onSetSelectedCells}
        onStartCellDrag={onStartCellDrag}
      />,
    );

    mockElementFromPoint([
      { row: 0, col: 0 }, // first gesture: pointerdown on filled cell
      { row: 0, col: 1 }, // pointermove crosses cells -> activates drag
      { row: 3, col: 3 }, // second gesture: pointerdown on the given cell tapped next
    ]);

    const region = screen.getByRole("region", { name: /sudoku board/i });
    // First gesture: digit drag (no trailing click, simulating iOS skip).
    fireEvent.pointerDown(region, {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    });
    fireEvent.pointerMove(region, {
      clientX: 140,
      clientY: 100,
      pointerId: 1,
    });
    fireEvent.pointerUp(region, { clientX: 140, clientY: 100, pointerId: 1 });
    expect(onStartCellDrag).toHaveBeenCalledTimes(1);

    // Second gesture: a still tap on a different given cell. Both
    // pointerdown and the synthesized click should flow through to the
    // cell's onSelect.
    fireEvent.pointerDown(region, {
      clientX: 300,
      clientY: 300,
      pointerId: 2,
    });
    fireEvent.pointerUp(region, { clientX: 300, clientY: 300, pointerId: 2 });
    const cell33 = document.querySelector(
      '[data-row="3"][data-col="3"]',
    ) as HTMLElement;
    fireEvent.click(cell33);

    expect(onSelectCell).toHaveBeenCalledWith(3, 3);
  });
});

describe("Board cursor affordance", () => {
  it("carries the cell cursor on the grid itself, not only on the cells", () => {
    // The 1–2px seams between cells belong to the grid element. Without
    // a cursor of its own the grid falls back to the default arrow, so
    // sweeping the pointer across the board makes the cursor blink
    // between the affordance and the arrow at every seam.
    render(
      <Board
        board={makeBoard()}
        selectedCell={null}
        conflicts={new Set()}
        onSelectCell={vi.fn()}
      />,
    );
    const region = screen.getByRole("region", { name: /sudoku board/i });
    expect(region.className).toContain("cursor-cell");
  });
});
