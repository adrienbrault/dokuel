import { CanvasTexture, Group, SRGBColorSpace } from "three";
import { describe, expect, it } from "vitest";
import { createCellKit } from "./cell-objects.ts";
import { atlasSymbols, type GlyphAtlas, glyphRects } from "./glyph-atlas.ts";
import { readPalette } from "./palette.ts";
import { BLOOM_THRESHOLD, markGlow } from "./pipeline.ts";

const EMOJI = ["🍎", "🍌", "🍇", "🍓", "🍊", "🍉", "🍒", "🥝", "🍍"];

/** Perceptual weight of a linear colour - what the bloom pass compares to. */
function luma(c: { r: number; g: number; b: number }) {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

function atlas(): GlyphAtlas {
  const symbols = atlasSymbols(true, EMOJI);
  return {
    ink: new CanvasTexture(document.createElement("canvas")),
    relief: new CanvasTexture(document.createElement("canvas")),
    symbols,
    rects: glyphRects(symbols.length, 3),
    dispose: () => {},
  };
}

/** A theme whose accent is the mid green the app actually ships with. */
function theme(): ReturnType<typeof readPalette> {
  return readPalette((name) =>
    name === "--color-accent" ? "#229c7c" : "#808080",
  );
}

describe("createCellKit", () => {
  it("builds a selection ring bright enough to bloom", () => {
    // The ring is the selection cue, and a ring that stays under the bloom
    // window draws as a flat outline with none of the glow that sells it.
    const kit = createCellKit(new Group(), theme(), atlas());
    const ring = kit.cells[0].selectionMaterial;
    expect(luma(ring.emissive) * ring.emissiveIntensity).toBeGreaterThan(
      BLOOM_THRESHOLD,
    );
    kit.dispose();
  });
});
