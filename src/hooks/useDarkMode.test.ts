import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDarkMode } from "./useDarkMode.ts";

let listeners: Array<() => void> = [];

function mockMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: prefersDark,
      addEventListener: (_event: string, handler: () => void) => {
        listeners.push(handler);
      },
      removeEventListener: (_event: string, handler: () => void) => {
        listeners = listeners.filter((h) => h !== handler);
      },
    }),
  });
}

describe("useDarkMode", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    listeners = [];
    mockMatchMedia(false);
  });

  it("defaults to system theme when localStorage is empty", () => {
    const { result } = renderHook(() => useDarkMode());
    expect(result.current.theme).toBe("system");
  });

  it("reads stored theme from localStorage", () => {
    localStorage.setItem("sudoku_theme", "dark");
    const { result } = renderHook(() => useDarkMode());
    expect(result.current.theme).toBe("dark");
  });

  it("applies dark class when theme is dark", () => {
    localStorage.setItem("sudoku_theme", "dark");
    renderHook(() => useDarkMode());
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("does not apply dark class when theme is light", () => {
    localStorage.setItem("sudoku_theme", "light");
    renderHook(() => useDarkMode());
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("setTheme persists to localStorage and updates state", () => {
    const { result } = renderHook(() => useDarkMode());
    act(() => result.current.setTheme("dark"));
    expect(result.current.theme).toBe("dark");
    expect(localStorage.getItem("sudoku_theme")).toBe("dark");
  });

  it("toggle switches from light to dark", () => {
    localStorage.setItem("sudoku_theme", "light");
    const { result } = renderHook(() => useDarkMode());
    act(() => result.current.toggle());
    expect(result.current.theme).toBe("dark");
  });

  it("toggle switches from dark to light", () => {
    localStorage.setItem("sudoku_theme", "dark");
    const { result } = renderHook(() => useDarkMode());
    // After render, dark class is applied
    act(() => result.current.toggle());
    expect(result.current.theme).toBe("light");
  });

  it("applies dark class when system prefers dark in system mode", () => {
    mockMatchMedia(true);
    renderHook(() => useDarkMode());
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("responds to system preference changes in system mode", () => {
    mockMatchMedia(false);
    renderHook(() => useDarkMode());
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    // Simulate system preference change to dark
    mockMatchMedia(true);
    act(() => {
      for (const listener of listeners) listener();
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
