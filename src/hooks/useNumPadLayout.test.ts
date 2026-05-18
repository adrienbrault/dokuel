import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useNumPadLayout } from "./useNumPadLayout.ts";

describe("useNumPadLayout", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("defaults to linear when no stored value", () => {
    const { result } = renderHook(() => useNumPadLayout());
    expect(result.current.layout).toBe("linear");
  });

  it("reads stored grid layout from localStorage", () => {
    localStorage.setItem("sudoku-numpad-layout", "grid");
    const { result } = renderHook(() => useNumPadLayout());
    expect(result.current.layout).toBe("grid");
  });

  it("ignores invalid stored values", () => {
    localStorage.setItem("sudoku-numpad-layout", "diamond");
    const { result } = renderHook(() => useNumPadLayout());
    expect(result.current.layout).toBe("linear");
  });

  it("updates layout and persists to localStorage", () => {
    const { result } = renderHook(() => useNumPadLayout());

    act(() => {
      result.current.setLayout("grid");
    });

    expect(result.current.layout).toBe("grid");
    expect(localStorage.getItem("sudoku-numpad-layout")).toBe("grid");
  });

  it("setLayout is referentially stable", () => {
    const { result, rerender } = renderHook(() => useNumPadLayout());
    const first = result.current.setLayout;
    rerender();
    expect(result.current.setLayout).toBe(first);
  });
});
