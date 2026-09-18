import { useEffect } from "react";
import { DEFAULT_EMOJI_THEME, findEmojiTheme } from "../lib/emoji-themes.ts";
import { useLocalStorage } from "./useLocalStorage.ts";

const STORAGE_KEY = "sudoku_emoji_theme";

function parseTheme(raw: string): string | null {
  return findEmojiTheme(raw) ? raw : null;
}

/**
 * Owns which emoji theme the board draws from.
 *
 * The symbols are published as CSS variables on the document root, so
 * the palette can swap all nine at once. Keeping them in CSS rather
 * than in the markup matters for more than re-renders: the numeral
 * stays in the DOM, so a cell still announces "value 5" to a screen
 * reader instead of the name of a piece of fruit.
 */
export function useEmojiTheme() {
  const [theme, setTheme] = useLocalStorage<string>(
    STORAGE_KEY,
    DEFAULT_EMOJI_THEME,
    parseTheme,
  );

  useEffect(() => {
    const resolved =
      findEmojiTheme(theme) ?? findEmojiTheme(DEFAULT_EMOJI_THEME);
    if (!resolved) return;
    const root = document.documentElement.style;
    resolved.symbols.forEach((symbol, index) => {
      // Quoted, because these are read straight into a `content`
      // declaration, which only accepts a string.
      root.setProperty(`--digit-emoji-${index + 1}`, `"${symbol}"`);
    });
  }, [theme]);

  return { theme, setTheme };
}
