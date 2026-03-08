// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAssistLevel } from "./useAssistLevel.ts";

describe("useAssistLevel", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("defaults to standard when no stored value", () => {
    const { result } = renderHook(() => useAssistLevel());
    expect(result.current.level).toBe("standard");
  });

  it("reads stored level from localStorage", () => {
    localStorage.setItem("sudoku_assist_level", "paper");
    const { result } = renderHook(() => useAssistLevel());
    expect(result.current.level).toBe("paper");
  });

  it("reads full level from localStorage", () => {
    localStorage.setItem("sudoku_assist_level", "full");
    const { result } = renderHook(() => useAssistLevel());
    expect(result.current.level).toBe("full");
  });

  it("ignores invalid stored values", () => {
    localStorage.setItem("sudoku_assist_level", "bogus");
    const { result } = renderHook(() => useAssistLevel());
    expect(result.current.level).toBe("standard");
  });

  it("updates level and persists to localStorage", () => {
    const { result } = renderHook(() => useAssistLevel());

    act(() => {
      result.current.setLevel("full");
    });

    expect(result.current.level).toBe("full");
    expect(localStorage.getItem("sudoku_assist_level")).toBe("full");
  });

  it("setLevel is referentially stable", () => {
    const { result, rerender } = renderHook(() => useAssistLevel());
    const first = result.current.setLevel;
    rerender();
    expect(result.current.setLevel).toBe(first);
  });
});
