import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useEmojiTheme } from "./useEmojiTheme.ts";

describe("useEmojiTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("style");
  });

  it("publishes the theme's symbols for the palette to draw", () => {
    // Same trick as the color palette: the symbols land on the root as
    // variables, so switching a theme repaints the board without any
    // cell re-rendering or losing the numeral screen readers announce.
    const { result } = renderHook(() => useEmojiTheme());

    act(() => result.current.setTheme("fruit"));

    const root = document.documentElement.style;
    expect(root.getPropertyValue("--digit-emoji-1")).toBe('"🍎"');
    expect(root.getPropertyValue("--digit-emoji-9")).toBe('"🥝"');
  });

  it("restores the stored theme on a fresh load", () => {
    localStorage.setItem("sudoku_emoji_theme", "space");

    const { result } = renderHook(() => useEmojiTheme());

    expect(result.current.theme).toBe("space");
    expect(
      document.documentElement.style.getPropertyValue("--digit-emoji-6"),
    ).toBe('"🚀"');
  });

  it("falls back to the default theme when storage names an unknown one", () => {
    localStorage.setItem("sudoku_emoji_theme", "dinosaurs");

    const { result } = renderHook(() => useEmojiTheme());

    expect(result.current.theme).toBe("shapes");
  });

  it("draws an imposed theme without touching the stored one", () => {
    // Same bargain as the mode: a shared room decides the symbols for
    // the match, and hands the player's own pick back afterwards.
    localStorage.setItem("sudoku_emoji_theme", "fruit");

    const { result } = renderHook(() => useEmojiTheme("vehicles"));

    expect(
      document.documentElement.style.getPropertyValue("--digit-emoji-1"),
    ).toBe('"🚗"');
    expect(localStorage.getItem("sudoku_emoji_theme")).toBe("fruit");
    expect(result.current.locked).toBe(true);
  });
});
