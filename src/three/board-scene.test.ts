import { describe, expect, it } from "vitest";
import { resolveCellHit } from "../lib/pointer-cell.ts";
import { createBoardScene } from "./board-scene.ts";
import { buildGlyphAtlas } from "./glyph-atlas.ts";
import { readPalette } from "./palette.ts";

const palette = readPalette(() => "");
const symbols = Array.from({ length: 9 }, (_, i) => String(i + 1));

function scene() {
  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 300;
  return createBoardScene(canvas, palette, symbols, {
    mono: true,
    boardPx: 300,
    reducedMotion: false,
  });
}

describe("createBoardScene", () => {
  it("declines to build where WebGL is missing", () => {
    expect(scene()).toBeNull();
  });

  it("declines to build where a 2D canvas is missing", () => {
    expect(buildGlyphAtlas(symbols, { mono: true })).toBeNull();
  });

  it("leaves no hit resolver behind when it declines", () => {
    expect(scene()).toBeNull();
    expect(resolveCellHit(150, 150)).toBeNull();
  });
});
