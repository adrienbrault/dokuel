import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Board, Position } from "../lib/types.ts";
import { useDigitHighlight } from "./useDigitHighlight.ts";

function emptyBoard(): Board {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => ({
      value: null as number | null,
      isGiven: false,
      notes: new Set<number>(),
    })),
  );
}

function makeHandlers(
  selectedCell: Position | null = null,
  selectedCellValue: number | null = null,
) {
  const board = emptyBoard();
  if (selectedCell && selectedCellValue !== null) {
    board[selectedCell.row]![selectedCell.col]!.value = selectedCellValue;
  }
  return {
    board,
    selectedCell,
    selectedCells:
      selectedCell === null
        ? new Set<number>()
        : new Set([selectedCell.row * 9 + selectedCell.col]),
    selectCell: vi.fn(),
    setSelectedCells: vi.fn(),
    deselectCell: vi.fn(),
    placeNumber: vi.fn(),
  };
}

describe("useDigitHighlight", () => {
  it("starts with no digit highlighted", () => {
    const { result } = renderHook(() => useDigitHighlight(makeHandlers()));
    expect(result.current.highlightedDigit).toBeNull();
  });

  it("toggles a digit on, then off when tapped again", () => {
    const { result } = renderHook(() => useDigitHighlight(makeHandlers()));

    act(() => {
      result.current.toggle(3);
    });
    expect(result.current.highlightedDigit).toBe(3);

    act(() => {
      result.current.toggle(3);
    });
    expect(result.current.highlightedDigit).toBeNull();
  });

  it("replaces the active digit when a different one is tapped", () => {
    const { result } = renderHook(() => useDigitHighlight(makeHandlers()));

    act(() => {
      result.current.toggle(3);
    });
    act(() => {
      result.current.toggle(7);
    });
    expect(result.current.highlightedDigit).toBe(7);
  });

  it("clears the highlight when selectCell is called and forwards args", () => {
    const handlers = makeHandlers();
    const { result } = renderHook(() => useDigitHighlight(handlers));

    act(() => {
      result.current.toggle(5);
    });
    expect(result.current.highlightedDigit).toBe(5);

    act(() => {
      result.current.selectCell(2, 4);
    });
    expect(result.current.highlightedDigit).toBeNull();
    expect(handlers.selectCell).toHaveBeenCalledWith(2, 4);
  });

  it("clears the highlight when setSelectedCells is called and forwards args", () => {
    const handlers = makeHandlers();
    const { result } = renderHook(() => useDigitHighlight(handlers));

    act(() => {
      result.current.toggle(2);
    });
    const cells = new Set([1, 2, 3]);
    const primary = { row: 0, col: 1 };
    act(() => {
      result.current.setSelectedCells(cells, primary);
    });
    expect(result.current.highlightedDigit).toBeNull();
    expect(handlers.setSelectedCells).toHaveBeenCalledWith(cells, primary);
  });

  it("clears the highlight when deselectCell is called and forwards the call", () => {
    const handlers = makeHandlers();
    const { result } = renderHook(() => useDigitHighlight(handlers));

    act(() => {
      result.current.toggle(6);
    });
    expect(result.current.highlightedDigit).toBe(6);

    act(() => {
      result.current.deselectCell();
    });
    expect(result.current.highlightedDigit).toBeNull();
    expect(handlers.deselectCell).toHaveBeenCalled();
  });

  it("skimToDigit sets the highlight and deselects the cell", () => {
    const handlers = makeHandlers();
    const { result } = renderHook(() => useDigitHighlight(handlers));

    act(() => {
      result.current.skimToDigit(6);
    });
    expect(result.current.highlightedDigit).toBe(6);
    expect(handlers.deselectCell).toHaveBeenCalled();
  });

  it("skimToDigit replaces the active highlight on every call", () => {
    const { result } = renderHook(() => useDigitHighlight(makeHandlers()));

    act(() => {
      result.current.skimToDigit(3);
    });
    act(() => {
      result.current.skimToDigit(8);
    });
    expect(result.current.highlightedDigit).toBe(8);
  });

  it("setDigit sets the highlight directly without toggling on repeat", () => {
    const { result } = renderHook(() => useDigitHighlight(makeHandlers()));

    act(() => {
      result.current.setDigit(4);
    });
    expect(result.current.highlightedDigit).toBe(4);

    act(() => {
      result.current.setDigit(4);
    });
    expect(result.current.highlightedDigit).toBe(4);

    act(() => {
      result.current.setDigit(8);
    });
    expect(result.current.highlightedDigit).toBe(8);
  });

  it("tapDigit toggles the highlight when no cell is selected", () => {
    const { result } = renderHook(() => useDigitHighlight(makeHandlers()));

    act(() => {
      result.current.tapDigit(3);
    });
    expect(result.current.highlightedDigit).toBe(3);

    act(() => {
      result.current.tapDigit(3);
    });
    expect(result.current.highlightedDigit).toBeNull();
  });

  it("tapDigit places the value when the selected cell is empty", () => {
    const handlers = makeHandlers({ row: 0, col: 0 });
    const { result } = renderHook(() => useDigitHighlight(handlers));

    act(() => {
      result.current.tapDigit(5);
    });
    expect(handlers.placeNumber).toHaveBeenCalledWith(5, true, false);
    expect(result.current.highlightedDigit).toBeNull();
  });

  it("tapDigit drops the selection and highlights the digit when the selected cell is filled", () => {
    const handlers = makeHandlers({ row: 0, col: 0 }, 7);
    const { result } = renderHook(() => useDigitHighlight(handlers));

    act(() => {
      result.current.tapDigit(4);
    });
    expect(handlers.deselectCell).toHaveBeenCalled();
    expect(handlers.placeNumber).not.toHaveBeenCalled();
    expect(result.current.highlightedDigit).toBe(4);
  });

  it("tapDigit pencils the digit as a note into a multi-cell selection", () => {
    // A range selection exists for one purpose: bulk notes. Tapping a
    // digit used to discard the painstaking selection and switch to
    // highlight mode — the exact opposite of what the player just set
    // up. The tap now does what hold does (note into every selected
    // cell) and keeps the selection so more digits can be added.
    const handlers = makeHandlers({ row: 0, col: 0 });
    // Simulate a multi-cell selection: the primary plus another cell.
    handlers.selectedCells = new Set([0, 1]);
    const { result } = renderHook(() => useDigitHighlight(handlers));

    act(() => {
      result.current.tapDigit(6);
    });
    expect(handlers.placeNumber).toHaveBeenCalledWith(6, true, true);
    expect(handlers.deselectCell).not.toHaveBeenCalled();
    expect(result.current.highlightedDigit).toBeNull();
  });

  it("tapDigit forwards the autoEliminateNotes flag to placeNumber", () => {
    const handlers = makeHandlers({ row: 0, col: 0 });
    const { result } = renderHook(() => useDigitHighlight(handlers, false));

    act(() => {
      result.current.tapDigit(5);
    });
    expect(handlers.placeNumber).toHaveBeenCalledWith(5, false, false);
  });
});
