import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useNumPadPosition } from "./useNumPadPosition.ts";

describe("useNumPadPosition", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("defaults to bottom when no stored value", () => {
    const { result } = renderHook(() => useNumPadPosition());
    expect(result.current.position).toBe("bottom");
  });

  it("reads stored position from localStorage", () => {
    localStorage.setItem("sudoku-numpad-position", "left");
    const { result } = renderHook(() => useNumPadPosition());
    expect(result.current.position).toBe("left");
  });

  it("reads right position from localStorage", () => {
    localStorage.setItem("sudoku-numpad-position", "right");
    const { result } = renderHook(() => useNumPadPosition());
    expect(result.current.position).toBe("right");
  });

  it("ignores invalid stored values", () => {
    localStorage.setItem("sudoku-numpad-position", "invalid");
    const { result } = renderHook(() => useNumPadPosition());
    expect(result.current.position).toBe("bottom");
  });

  it("updates position and persists to localStorage", () => {
    const { result } = renderHook(() => useNumPadPosition());

    act(() => {
      result.current.setPosition("left");
    });

    expect(result.current.position).toBe("left");
    expect(localStorage.getItem("sudoku-numpad-position")).toBe("left");
  });

  it("can cycle through all positions", () => {
    const { result } = renderHook(() => useNumPadPosition());

    act(() => result.current.setPosition("left"));
    expect(result.current.position).toBe("left");

    act(() => result.current.setPosition("right"));
    expect(result.current.position).toBe("right");

    act(() => result.current.setPosition("bottom"));
    expect(result.current.position).toBe("bottom");
  });

  it("setPosition is referentially stable", () => {
    const { result, rerender } = renderHook(() => useNumPadPosition());
    const first = result.current.setPosition;
    rerender();
    expect(result.current.setPosition).toBe(first);
  });
});
