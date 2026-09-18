import { useEffect } from "react";
import type { DigitColorMode } from "../lib/types.ts";
import { useLocalStorage } from "./useLocalStorage.ts";

const STORAGE_KEY = "sudoku_digit_color_mode";

function parseMode(raw: string): DigitColorMode | null {
  return raw === "off" ||
    raw === "digits" ||
    raw === "colors" ||
    raw === "emoji"
    ? raw
    : null;
}

/**
 * Owns the digit palette mode.
 *
 * The mode lands on the document root rather than flowing down as a
 * prop: the palette itself is CSS, so one attribute repaints all 81
 * cells and the numpad without re-rendering a single memoized Cell.
 * That also lets several mounted copies of this hook (the settings
 * popover, the board) agree without a shared store, the same way
 * useDarkMode does.
 *
 * `imposed` is the multiplayer room's shared palette. It wins for what
 * the board draws, but never reaches storage: the player is lending
 * their board for a match, not changing their mind.
 */
export function useDigitColorMode(imposed?: DigitColorMode | null) {
  const [stored, setMode] = useLocalStorage<DigitColorMode>(
    STORAGE_KEY,
    "off",
    parseMode,
  );
  const mode = imposed ?? stored;

  useEffect(() => {
    if (mode === "off") {
      delete document.documentElement.dataset.digitColor;
      return;
    }
    document.documentElement.dataset.digitColor = mode;
  }, [mode]);

  return { mode, setMode };
}
