import { describe, expect, it } from "vitest";
import {
  atlasSymbols,
  buildGlyphAtlas,
  glyphRects,
  glyphSymbol,
  remapPlaneUvs,
} from "./glyph-atlas.ts";

const EMOJI = ["🍎", "🍌", "🍇", "🍓", "🍊", "🍉", "🍒", "🥝", "🍍"];

describe("glyphRects", () => {
  it("lays nine glyphs out on a 3×3 atlas in digit order", () => {
    const rects = glyphRects(9, 3);
    expect(rects).toHaveLength(9);
    // Digit 1 sits in the top-left cell of the atlas.
    expect(rects[0]).toEqual({ u0: 0, u1: 1 / 3, v0: 2 / 3, v1: 1 });
    // Digit 9 is the bottom-right cell.
    expect(rects[8]).toEqual({ u0: 2 / 3, u1: 1, v0: 0, v1: 1 / 3 });
    // Digit 5 is the middle of the middle row.
    expect(rects[4]).toEqual({
      u0: 1 / 3,
      u1: 2 / 3,
      v0: 1 / 3,
      v1: 2 / 3,
    });
  });

  it("does not clip a partially filled row", () => {
    const rects = glyphRects(4, 3);
    expect(rects).toHaveLength(4);
    // Four glyphs fill one row of three plus one more row.
    expect(rects[3]!.u0).toBe(0);
    expect(rects[3]!.v1).toBe(0.5);
  });

  it("keeps every rect inside the unit square", () => {
    for (const rect of glyphRects(12, 4)) {
      expect(rect.u0).toBeGreaterThanOrEqual(0);
      expect(rect.u1).toBeLessThanOrEqual(1);
      expect(rect.v0).toBeGreaterThanOrEqual(0);
      expect(rect.v1).toBeLessThanOrEqual(1);
      expect(rect.u1).toBeGreaterThan(rect.u0);
      expect(rect.v1).toBeGreaterThan(rect.v0);
    }
  });
});

describe("remapPlaneUvs", () => {
  it("maps a whole-unit plane into one atlas cell", () => {
    const geometry = {
      attributes: { uv: { array: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]) } },
    };
    remapPlaneUvs(geometry as never, { u0: 0, u1: 0.5, v0: 0, v1: 0.5 });
    expect(Array.from(geometry.attributes.uv.array)).toEqual([
      0, 0, 0.5, 0, 0, 0.5, 0.5, 0.5,
    ]);
  });

  it("offsets a partial cell so a glyph is centred inside it", () => {
    const geometry = {
      attributes: { uv: { array: new Float32Array([0, 0, 1, 1]) } },
    };
    // A rect inset by a tenth on each side of the first atlas cell.
    remapPlaneUvs(geometry as never, {
      u0: 0 + 0.1 / 3,
      u1: 1 / 3 - 0.1 / 3,
      v0: 2 / 3 + 0.1 / 3,
      v1: 1 - 0.1 / 3,
    });
    const [u0, v0, u1, v1] = Array.from(geometry.attributes.uv.array);
    expect(u0).toBeCloseTo(0.1 / 3, 5);
    expect(v0).toBeCloseTo(2 / 3 + 0.1 / 3, 5);
    expect(u1).toBeCloseTo(1 / 3 - 0.1 / 3, 5);
    expect(v1).toBeCloseTo(1 - 0.1 / 3, 5);
  });
});
describe("buildGlyphAtlas", () => {
  it("reports nothing to build when the canvas cannot be painted", () => {
    // Headless runs have no 2D context; the caller needs the null so it
    // can keep the DOM board instead of rendering an empty scene.
    expect(buildGlyphAtlas(["1", "2", "3"], { mono: true })).toBeNull();
  });
});

describe("atlasSymbols", () => {
  it("holds numerals while digits are drawn as digits", () => {
    // A value glyph asks for its numeral; an atlas of emoji has no such
    // slot, so every digit would fall back to the same first cell.
    expect(atlasSymbols(true, EMOJI)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
    ]);
  });

  it("holds the themed emoji when symbols are drawn as emoji", () => {
    expect(atlasSymbols(false, EMOJI)).toEqual(EMOJI);
  });

  it("fills a nine-slot atlas even when the theme is short", () => {
    // Digit-indexed lookup has to keep working, so a missing symbol
    // takes its numeral rather than shifting every later glyph.
    expect(atlasSymbols(false, ["", "🍌"])).toEqual([
      "1",
      "🍌",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
    ]);
  });
});

describe("glyphSymbol", () => {
  it("draws a digit's own numeral while digits are drawn as digits", () => {
    expect(glyphSymbol(5, true, EMOJI)).toBe("5");
  });

  it("draws the themed emoji for a digit when symbols are emoji", () => {
    expect(glyphSymbol(5, false, EMOJI)).toBe("🍊");
  });

  it("falls back to the numeral when the theme has no symbol", () => {
    expect(glyphSymbol(5, false, [])).toBe("5");
  });
});
