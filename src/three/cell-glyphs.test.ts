import {
  BoxGeometry,
  CanvasTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
} from "three";
import { describe, expect, it } from "vitest";
import { createGlyphKit } from "./cell-glyphs.ts";
import type { CellObjects } from "./cell-objects.ts";
import { atlasSymbols, type GlyphAtlas, glyphRects } from "./glyph-atlas.ts";
import { readPalette } from "./palette.ts";
import type { CellVisual } from "./scene-state.ts";

const EMOJI = ["🍎", "🍌", "🍇", "🍓", "🍊", "🍉", "🍒", "🥝", "🍍"];

const palette = readPalette(() => "#ffffff");

function texture(): CanvasTexture {
  return new CanvasTexture(document.createElement("canvas"));
}

function fakeAtlas(mono: boolean): GlyphAtlas {
  const symbols = atlasSymbols(mono, EMOJI);
  return {
    ink: texture(),
    relief: mono ? texture() : null,
    symbols,
    rects: glyphRects(symbols.length, 3),
    dispose: () => {},
  };
}

function emptyObjects(): CellObjects {
  const tile = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  return {
    tile,
    tileMaterial: tile.material as MeshStandardMaterial,
    selectionRing: new Mesh(new BoxGeometry(), new MeshStandardMaterial()),
    selectionMaterial: new MeshStandardMaterial(),
    value: null,
    valueMaterial: null,
    swatch: null,
    swatchMaterial: null,
    conflictRing: null,
    notes: [null, null, null, null, null, null, null, null, null],
    selected: false,
    lift: 0,
    glow: 0,
    colour: palette.cell.clone(),
    popAt: -1,
    revealAt: -1,
    lastValue: null,
  };
}

function notesCell(notes: number[]): CellVisual {
  return {
    row: 0,
    col: 0,
    state: "idle",
    ink: "user",
    value: null,
    isGiven: false,
    notes,
    emoji: null,
    hover: false,
    charging: false,
    dragSource: false,
    dropTarget: null,
    dropMode: "value",
    dropDigit: null,
    revealDelayMs: null,
  };
}

function paintedNotes(mono: boolean, notes: number[]) {
  const kit = createGlyphKit(fakeAtlas(mono), palette);
  const board = new Group();
  const objects = emptyObjects();
  kit.applyNotes(board, objects, notesCell(notes), 0, 0);
  return objects.notes.filter(Boolean).map((note) => note!.userData.symbol);
}

describe("applyNotes", () => {
  it("draws each note's own numeral, not its place in the list", () => {
    // Notes arrive sorted, so slot order is not digit order: pencilling
    // 3 and 7 has to paint 3 and 7, never 1 and 2.
    expect(paintedNotes(true, [3, 7])).toEqual(["3", "7"]);
  });

  it("draws the themed emoji for a note in emoji mode", () => {
    expect(paintedNotes(false, [3, 7])).toEqual(["🍇", "🍒"]);
  });
});
