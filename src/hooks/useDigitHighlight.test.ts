import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDigitHighlight } from "./useDigitHighlight.ts";

function makeHandlers() {
  return {
    selectCell: vi.fn(),
    setSelectedCells: vi.fn(),
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
