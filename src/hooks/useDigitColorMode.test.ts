import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useDigitColorMode } from "./useDigitColorMode.ts";

describe("useDigitColorMode", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.digitColor;
  });

  it("marks the document root so the palette reaches every digit at once", () => {
    // The palette is CSS, not props: 81 cells and 9 numpad keys pick up
    // the mode from this one attribute instead of re-rendering.
    const { result } = renderHook(() => useDigitColorMode());

    act(() => result.current.setMode("colors"));

    expect(document.documentElement.dataset.digitColor).toBe("colors");
  });

  it("restores the stored mode on a fresh load", () => {
    // A reload must come back painted; otherwise the player has to
    // re-pick the mode every session.
    localStorage.setItem("sudoku_digit_color_mode", "digits");

    const { result } = renderHook(() => useDigitColorMode());

    expect(result.current.mode).toBe("digits");
    expect(document.documentElement.dataset.digitColor).toBe("digits");
  });

  it("leaves the root unmarked when switched off", () => {
    // "off" is the plain board, so the attribute has to go rather than
    // linger with a falsy-looking value the palette might still match.
    const { result } = renderHook(() => useDigitColorMode());

    act(() => result.current.setMode("colors"));
    act(() => result.current.setMode("off"));

    expect(document.documentElement.dataset.digitColor).toBeUndefined();
  });

  it("falls back to off when storage holds something unusable", () => {
    localStorage.setItem("sudoku_digit_color_mode", "rainbow");

    const { result } = renderHook(() => useDigitColorMode());

    expect(result.current.mode).toBe("off");
  });

  it("paints the board from an imposed mode without touching the stored one", () => {
    // A shared multiplayer room overrides what both boards draw, but a
    // player's own preference has to survive the match: they never
    // chose to change it.
    localStorage.setItem("sudoku_digit_color_mode", "digits");

    renderHook(() => useDigitColorMode("emoji"));

    expect(document.documentElement.dataset.digitColor).toBe("emoji");
    expect(localStorage.getItem("sudoku_digit_color_mode")).toBe("digits");
  });
});
