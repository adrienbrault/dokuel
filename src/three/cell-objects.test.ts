import { CanvasTexture, Group } from "three";
import { describe, expect, it } from "vitest";
import { createCellKit } from "./cell-objects.ts";
import { atlasSymbols, type GlyphAtlas, glyphRects } from "./glyph-atlas.ts";
import { readPalette } from "./palette.ts";
import { BLOOM_THRESHOLD } from "./pipeline.ts";

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

/** A theme whose accent is whichever colour the caller names. */
function theme(accent: string): ReturnType<typeof readPalette> {
  return readPalette((name) =>
    name === "--color-accent" ? accent : "#808080",
  );
}

describe("createCellKit", () => {
  it("builds a selection ring bright enough to bloom", () => {
    // The ring is the selection cue, and a ring that stays under the bloom
    // window draws as a flat outline with none of the glow that sells it.
    const kit = createCellKit(new Group(), theme("#229c7c"), atlas());
    const ring = kit.cells[0]?.selectionMaterial;
    const glow = ring && luma(ring.emissive) * ring.emissiveIntensity;
    expect(glow).toBeGreaterThan(BLOOM_THRESHOLD);
    kit.dispose();
  });

  it("keeps the ring blooming through a theme flip", () => {
    // A flip writes the new accent into the ring's emissive, and an
    // intensity chosen for the old colour no longer suits the new one.
    const kit = createCellKit(new Group(), theme("#229c7c"), atlas());
    kit.setPalette(theme("#f4d03f"));
    const ring = kit.cells[0]?.selectionMaterial;
    const glow = ring && luma(ring.emissive) * ring.emissiveIntensity;
    expect(glow).toBeGreaterThan(BLOOM_THRESHOLD);
    expect(glow).toBeLessThan(2);
    kit.dispose();
  });
});
