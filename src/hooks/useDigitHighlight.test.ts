import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Position } from "../lib/types.ts";
import { useDigitHighlight } from "./useDigitHighlight.ts";

function makeHandlers(selectedCell: Position | null = null) {
  return {
    selectedCell,
    selectedCells: new Set<number>(),
    selectCell: vi.fn(),
    setSelectedCells: vi.fn(),
    deselectCell: vi.fn(),
    placeNumberAt: vi.fn(),
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

  it("tapDigit drops the selection and highlights the digit when a cell is selected", () => {
    const handlers = makeHandlers({ row: 0, col: 0 });
    const { result } = renderHook(() => useDigitHighlight(handlers));

    act(() => {
      result.current.tapDigit(5);
    });
    expect(result.current.highlightedDigit).toBe(5);
    expect(handlers.deselectCell).toHaveBeenCalled();
  });

  it("tapCell selects the cell when no digit is highlighted", () => {
    const handlers = makeHandlers();
    const { result } = renderHook(() => useDigitHighlight(handlers));

    act(() => {
      result.current.tapCell(2, 3);
    });
    expect(handlers.selectCell).toHaveBeenCalledWith(2, 3);
    expect(handlers.placeNumberAt).not.toHaveBeenCalled();
  });

  it("tapCell fills the cell with the active digit, which stays highlighted", () => {
    const handlers = makeHandlers();
    const { result } = renderHook(() => useDigitHighlight(handlers));

    act(() => {
      result.current.tapDigit(7);
    });
    act(() => {
      result.current.tapCell(1, 2);
    });

    expect(handlers.placeNumberAt).toHaveBeenCalledWith(1, 2, 7, true);
    expect(handlers.selectCell).not.toHaveBeenCalled();
    // The digit stays active so the next cell tap places it again.
    expect(result.current.highlightedDigit).toBe(7);
  });

  it("tapCell forwards the autoEliminateNotes flag", () => {
    const handlers = makeHandlers();
    const { result } = renderHook(() => useDigitHighlight(handlers, false));

    act(() => {
      result.current.tapDigit(4);
    });
    act(() => {
      result.current.tapCell(0, 0);
    });

    expect(handlers.placeNumberAt).toHaveBeenCalledWith(0, 0, 4, false);
  });
});
