import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDigitHighlight } from "./useDigitHighlight.ts";

function makeHandlers() {
  return {
    selectCell: vi.fn(),
    setSelectedCells: vi.fn(),
    deselectCell: vi.fn(),
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

  it("endNumpadPress promotes the placed digit to the highlight and deselects", () => {
    const handlers = makeHandlers();
    const { result } = renderHook(() => useDigitHighlight(handlers));

    act(() => {
      result.current.endNumpadPress(7);
    });
    expect(result.current.highlightedDigit).toBe(7);
    expect(handlers.deselectCell).toHaveBeenCalled();
  });

  it("endNumpadPress with no placed digit deselects but keeps the highlight", () => {
    const handlers = makeHandlers();
    const { result } = renderHook(() => useDigitHighlight(handlers));

    act(() => {
      result.current.toggle(4);
    });
    act(() => {
      result.current.endNumpadPress(null);
    });
    expect(result.current.highlightedDigit).toBe(4);
    expect(handlers.deselectCell).toHaveBeenCalled();
  });

  it("endNumpadPress keeps an already-highlighted digit over the placed one", () => {
    const handlers = makeHandlers();
    const { result } = renderHook(() => useDigitHighlight(handlers));

    // A skim settled on 5; releasing on the originally-pressed 3 must
    // not snap the highlight back.
    act(() => {
      result.current.skimToDigit(5);
    });
    act(() => {
      result.current.endNumpadPress(3);
    });
    expect(result.current.highlightedDigit).toBe(5);
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
});
