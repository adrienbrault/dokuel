import { describe, expect, it } from "vitest";
import { parseCssColor, readEmojiSymbols, readPalette } from "./palette.ts";

function closeTo(actual: number[], expected: number[]) {
  expect(actual).toHaveLength(3);
  for (let i = 0; i < 3; i++) {
    expect(actual[i]!).toBeCloseTo(expected[i]!, 2);
  }
}

describe("parseCssColor", () => {
  it("reads hex, including the shorthand form", () => {
    closeTo(parseCssColor("#ff8000")!, [1, 0.502, 0]);
    closeTo(parseCssColor("#fff")!, [1, 1, 1]);
    closeTo(parseCssColor("  #000 ")!, [0, 0, 0]);
  });

  it("reads rgb() with commas or spaces, and ignores alpha", () => {
    closeTo(parseCssColor("rgb(0, 128, 255)")!, [0, 0.502, 1]);
    closeTo(parseCssColor("rgb(0 128 255)")!, [0, 0.502, 1]);
    closeTo(parseCssColor("rgba(0, 128, 255, 0.4)")!, [0, 0.502, 1]);
  });

  it("reads percentage rgb()", () => {
    closeTo(parseCssColor("rgb(100%, 50%, 0%)")!, [1, 0.5, 0]);
  });

  it("converts oklch() to sRGB without clipping its primaries", () => {
    // Neutral mid-grey: Chrome computes oklch(0.5 0 0) to rgb(99 99 99).
    const grey = parseCssColor("oklch(0.5 0 0)")!;
    closeTo(grey, [0.389, 0.389, 0.389]);
    // Pure blue primary has one saturated channel and two zeros.
    const blue = parseCssColor("oklch(0.45 0.31 264)")!;
    expect(blue[2]!).toBeGreaterThan(0.8);
    expect(blue[0]!).toBeLessThan(0.1);
  });

  it("returns null for anything it cannot resolve", () => {
    expect(parseCssColor("")).toBeNull();
    expect(parseCssColor("var(--nope)")).toBeNull();
    expect(
      parseCssColor("color-mix(in srgb, var(--x), transparent)"),
    ).toBeNull();
  });
});

describe("readPalette", () => {
  /** A reader that maps every token to opaque black. */
  const black = () => "rgb(0, 0, 0)";

  it("resolves every surface, ink and digit token the scene paints", () => {
    const palette = readPalette(black);
    expect(palette.page.getHex()).toBe(0x000000);
    expect(palette.slab.getHex()).toBe(0x000000);
    expect(palette.cell.getHex()).toBe(0x000000);
    expect(palette.selected.getHex()).toBe(0x000000);
    expect(palette.conflict.getHex()).toBe(0x000000);
    expect(palette.digits).toHaveLength(9);
    expect(palette.digits.every((c) => c.getHex() === 0x000000)).toBe(true);
  });

  it("keeps digits indexed one-to-nine, so digit 1 is the first entry", () => {
    const palette = readPalette((name) =>
      name === "--color-digit-1" ? "rgb(255, 0, 0)" : "rgb(0, 0, 0)",
    );
    expect(palette.digits[0]!.getHex()).toBe(0xff0000);
    expect(palette.digits[1]!.getHex()).toBe(0x000000);
  });

  it("falls back to a readable neutral when a token will not parse", () => {
    const palette = readPalette(() => "");
    for (const color of [palette.page, palette.cell, palette.given]) {
      // Still a valid, opaque colour rather than three undefined channels.
      expect(color.getHex()).toBeGreaterThanOrEqual(0);
      expect(color.getHex()).toBeLessThanOrEqual(0xffffff);
    }
    expect(palette.digits).toHaveLength(9);
  });
});

describe("readEmojiSymbols", () => {
  it("reads the nine theme symbols and drops their CSS quoting", () => {
    const symbols = readEmojiSymbols((name) =>
      name === "--digit-emoji-1"
        ? '"🍎"'
        : name === "--digit-emoji-9"
          ? '"🍇"'
          : "",
    );
    expect(symbols).toHaveLength(9);
    expect(symbols[0]).toBe("🍎");
    expect(symbols[8]).toBe("🍇");
  });

  it("falls back to the default theme when the custom properties are unset", () => {
    const symbols = readEmojiSymbols(() => "");
    expect(symbols).toHaveLength(9);
    expect(symbols.every((s) => s.length > 0)).toBe(true);
  });
});
