import { describe, expect, it } from "vitest";
import { EMOJI_THEMES } from "./emoji-themes.ts";

describe("emoji themes", () => {
  it("gives every digit 1-9 a symbol in every theme", () => {
    // A theme one short would silently leave a digit unpainted, and
    // the gap would only ever show up on a board that happens to use
    // that digit.
    for (const theme of EMOJI_THEMES) {
      expect(theme.symbols, theme.id).toHaveLength(9);
    }
  });

  it("keeps every symbol distinct within a theme", () => {
    // Two digits sharing a symbol makes the board unsolvable to read.
    for (const theme of EMOJI_THEMES) {
      expect(new Set(theme.symbols).size, theme.id).toBe(9);
    }
  });

  it("has ten themes with unique ids", () => {
    expect(EMOJI_THEMES).toHaveLength(10);
    expect(new Set(EMOJI_THEMES.map((t) => t.id)).size).toBe(10);
  });
});
