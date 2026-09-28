import { CanvasTexture, Group } from "three";
import { describe, expect, it } from "vitest";
import { createCellKit, type CellKitContext } from "./cell-objects.ts";
import { atlasSymbols, type GlyphAtlas, glyphRects } from "./glyph-atlas.ts";
import { readPalette } from "./palette.ts";
import { BLOOM_THRESHOLD } from "./pipeline.ts";
import type { CellVisual } from "./scene-state.ts";

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

/** A theme whose tiles are as dark as the dark-mode token. */
function darkTheme(): ReturnType<typeof readPalette> {
  return readPalette((name) =>
    name === "--color-cell-bg" ? "#131110" : "#808080",
  );
}

function visual(overrides: Partial<CellVisual> = {}): CellVisual {
  return {
    row: 0,
    col: 0,
    state: "idle",
    ink: "user",
    value: null,
    isGiven: false,
    notes: [],
    emoji: null,
    hover: false,
    charging: false,
    dragSource: false,
    dropTarget: null,
    dropMode: "value",
    dropDigit: null,
    revealDelayMs: null,
    ...overrides,
  };
}

function context(palette: ReturnType<typeof readPalette>): CellKitContext {
  return { palette, digitMode: "off", elapsed: 0, onPlace: () => {} };
}

describe("createCellKit", () => {
  it("hands a dark tile the albedo that lands it on its token", () => {
    // The curve is quadratic near black, so a tile handed its own dark
    // token arrives as charcoal - measured at rgb 9 for a token of 19.
    const palette = darkTheme();
    const kit = createCellKit(new Group(), palette, atlas());
    kit.apply([visual()], context(palette));
    const colour = kit.cells[0]?.colour;
    expect(colour?.r).toBeGreaterThan(palette.cell.r);
    kit.dispose();
  });

  it("hands a dark digit the albedo that lands it on its ink token", () => {
    // Digits are tinted, not painted, so they go through the same curve as
    // the tile under them - and a soft near-black ink was arriving black.
    const palette = readPalette((name) =>
      name === "--color-cell-given" ? "#1c1a17" : "#808080",
    );
    const kit = createCellKit(new Group(), palette, atlas());
    kit.apply([visual({ value: 5, isGiven: true, ink: "given" })], context(palette));
    const material = kit.cells[0]?.valueMaterial;
    expect(material?.color.r).toBeGreaterThan(palette.given.r);
    kit.dispose();
  });

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
