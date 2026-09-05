import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDarkMode } from "./useDarkMode.ts";

let listeners: Array<() => void> = [];
const systemPreference = { dark: false };

function mockMatchMedia(prefersDark: boolean) {
  systemPreference.dark = prefersDark;
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({
      get matches() {
        return systemPreference.dark;
      },
      addEventListener: (_event: string, handler: () => void) => {
        listeners.push(handler);
      },
      removeEventListener: (_event: string, handler: () => void) => {
        listeners = listeners.filter((h) => h !== handler);
      },
    }),
  });
}

function fireSystemPreferenceChange(prefersDark: boolean) {
  systemPreference.dark = prefersDark;
  for (const handler of [...listeners]) handler();
}

function getOverrideThemeColor(): string | null {
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]:not([media])',
  );
  return meta?.content ?? null;
}

describe("useDarkMode", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    listeners = [];
    mockMatchMedia(false);
    for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
      m.remove();
    }
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

  it("reports isDark in the same render pass as the toggle", () => {
    // isDark used to be read from the DOM class during render, but the
    // class is applied in an effect AFTER that render — so the toggle
    // icon and its aria-label showed the previous state until some
    // unrelated re-render happened by.
    const { result } = renderHook(() => useDarkMode());
    act(() => result.current.toggle());
    expect(result.current.isDark).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.isDark).toBe(false);
  });

  it("updates isDark when the OS preference flips in system mode", () => {
    const { result } = renderHook(() => useDarkMode());
    expect(result.current.isDark).toBe(false);

    act(() => fireSystemPreferenceChange(true));

    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
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

  it("does not write a non-media theme-color override in system mode", () => {
    renderHook(() => useDarkMode());
    expect(getOverrideThemeColor()).toBeNull();
  });

  it("sets a dark theme-color override when manually selecting dark", () => {
    localStorage.setItem("sudoku_theme", "dark");
    renderHook(() => useDarkMode());
    expect(getOverrideThemeColor()).toBe("#192322");
  });

  it("sets a light theme-color override when manually selecting light", () => {
    localStorage.setItem("sudoku_theme", "light");
    renderHook(() => useDarkMode());
    expect(getOverrideThemeColor()).toBe("#f7f5ef");
  });

  it("removes the theme-color override when switching back to system", () => {
    const { result } = renderHook(() => useDarkMode());
    act(() => result.current.setTheme("dark"));
    expect(getOverrideThemeColor()).toBe("#192322");
    act(() => result.current.setTheme("system"));
    expect(getOverrideThemeColor()).toBeNull();
  });
});
