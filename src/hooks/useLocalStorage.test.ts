import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useLocalStorage } from "./useLocalStorage.ts";

const KEY = "test-key";

type Mode = "a" | "b" | "c";
const parseMode = (raw: string): Mode | null =>
  raw === "a" || raw === "b" || raw === "c" ? raw : null;

describe("useLocalStorage", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("returns initial when key is absent", () => {
    const { result } = renderHook(() =>
      useLocalStorage<Mode>(KEY, "a", parseMode),
    );
    expect(result.current[0]).toBe("a");
  });

  it("returns parsed stored value", () => {
    localStorage.setItem(KEY, "b");
    const { result } = renderHook(() =>
      useLocalStorage<Mode>(KEY, "a", parseMode),
    );
    expect(result.current[0]).toBe("b");
  });

  it("falls back to initial when parser returns null", () => {
    localStorage.setItem(KEY, "garbage");
    const { result } = renderHook(() =>
      useLocalStorage<Mode>(KEY, "a", parseMode),
    );
    expect(result.current[0]).toBe("a");
  });

  it("persists writes to localStorage", () => {
    const { result } = renderHook(() =>
      useLocalStorage<Mode>(KEY, "a", parseMode),
    );
    act(() => result.current[1]("c"));
    expect(result.current[0]).toBe("c");
    expect(localStorage.getItem(KEY)).toBe("c");
  });

  it("setter is referentially stable across renders", () => {
    const { result, rerender } = renderHook(() =>
      useLocalStorage<Mode>(KEY, "a", parseMode),
    );
    const first = result.current[1];
    rerender();
    expect(result.current[1]).toBe(first);
  });

  it("works with booleans (String() round-trip)", () => {
    const parseBool = (raw: string): boolean | null =>
      raw === "true" ? true : raw === "false" ? false : null;
    const { result } = renderHook(() =>
      useLocalStorage<boolean>(KEY, true, parseBool),
    );
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
    expect(localStorage.getItem(KEY)).toBe("false");
  });
});
