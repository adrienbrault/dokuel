import { findEmojiTheme } from "./emoji-themes.ts";
import type { DigitStyle } from "./types.ts";

/**
 * Reads a digit style back as a sentence, for the players who are
 * shown one rather than asked to pick it: a greyed-out picker would
 * invite clicks that do nothing.
 */
export function describeDigitStyle(style: DigitStyle): string {
  switch (style.mode) {
    case "off":
      return "Plain digits";
    case "digits":
      return "Tinted digits";
    case "colors":
      return "Colors only";
    case "emoji":
      return `Emoji · ${findEmojiTheme(style.emojiTheme)?.label ?? "Shapes"}`;
  }
}
