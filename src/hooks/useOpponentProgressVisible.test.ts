// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useOpponentProgressVisible } from "./useOpponentProgressVisible.ts";

const STORAGE_KEY = "sudoku-opponent-progress-visible";

describe("useOpponentProgressVisible", () => {
  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it("defaults to visible when no stored value", () => {
    const { result } = renderHook(() => useOpponentProgressVisible());
    expect(result.current.visible).toBe(true);
  });

  it("reads stored false value from localStorage", () => {
    localStorage.setItem(STORAGE_KEY, "false");
    const { result } = renderHook(() => useOpponentProgressVisible());
    expect(result.current.visible).toBe(false);
  });

  it("toggles visibility and persists to localStorage", () => {
    const { result } = renderHook(() => useOpponentProgressVisible());
    expect(result.current.visible).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.visible).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("false");

    act(() => result.current.toggle());
    expect(result.current.visible).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
  });
});
