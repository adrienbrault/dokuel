import {
  CircleGeometry,
  type Group,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { CellObjects } from "./cell-objects.ts";
import { createGlyphGeometry, type GlyphAtlas } from "./glyph-atlas.ts";
import {
  noteOffset,
  noteRowOffset,
  noteSize,
  TILE,
  TILE_DEPTH,
} from "./layout.ts";
import type { BoardPalette } from "./palette.ts";
import type { CellVisual } from "./scene-state.ts";

/** World size of a value glyph; the atlas fills 86% of its cell. */
export const VALUE_SIZE = 0.84;
/** World size of a pencilled note glyph. */
export const NOTE_SIZE = noteSize() * 0.82;

export type GlyphKit = {
  /** The material a charging note wears, so a beat can be driven off it. */
  chargingMaterial: MeshStandardMaterial;
  isCharging(mesh: Mesh): boolean;
  ensureValue(board: Group, objects: CellObjects, symbol: string): Mesh;
  ensureSwatch(board: Group, objects: CellObjects, given: boolean): Mesh;
  applyConflictRing(
    objects: CellObjects,
    cell: CellVisual,
    palette: BoardPalette,
  ): void;
  applyNotes(
    board: Group,
    objects: CellObjects,
    cell: CellVisual,
    x: number,
    y: number,
  ): void;
  /** Points every glyph at a new atlas - a new emoji theme, or the webfont arriving. */
  setAtlas(atlas: GlyphAtlas, mono: boolean, cells: CellObjects[]): void;
  setPalette(palette: BoardPalette): void;
  dispose(): void;
};

/**
 * The marks that stand on a tile: digits, colour swatches, and pencilled
 * notes.
 *
 * Notes are the one thing here shared outright. Ninety cells carrying up
 * to nine notes each, every note its own material, would triple the
 * board's draw calls to render marks that are all the same colour except
 * while one of them is charging.
 */
export function createGlyphKit(
  atlas: GlyphAtlas,
  palette: BoardPalette,
): GlyphKit {
  let currentAtlas = atlas;
  let currentPalette = palette;
  let mono = Boolean(atlas.relief);

  const discGeometry = new CircleGeometry(0.29, 40);
  const swatchGeometry = new RoundedBoxGeometry(0.58, 0.58, 0.06, 2, 0.1);
  const conflictRingGeometry = new RingGeometry(0.31, 0.38, 40);
  /** Geometry per glyph and size, shared by every cell showing it. */
  const geometries = new Map<string, ReturnType<typeof createGlyphGeometry>>();

  function geometry(symbol: string, size: number) {
    const key = `${symbol}:${size}`;
    let cached = geometries.get(key);
    if (!cached) {
      const slot = currentAtlas.symbols.indexOf(symbol);
      cached = createGlyphGeometry(
        currentAtlas.rects[slot < 0 ? 0 : slot]!,
        size,
        mono ? 14 : 1,
      );
      geometries.set(key, cached);
    }
    return cached;
  }

  const noteMaterial = new MeshStandardMaterial({
    map: currentAtlas.ink,
    color: currentPalette.note,
    transparent: true,
    opacity: 0.9,
    roughness: 0.6,
    metalness: 0,
    depthWrite: false,
  });
  const chargingMaterial = new MeshStandardMaterial({
    map: currentAtlas.ink,
    color: currentPalette.accentBright,
    emissive: currentPalette.accentBright,
    emissiveIntensity: 0.8,
    transparent: true,
    roughness: 0.4,
    metalness: 0,
    depthWrite: false,
  });

  /**
   * A monochrome atlas is white ink on transparency, so the relief
   * carries its own coverage and doubles as the shadow cutout. Its
   * height is what lets a digit throw a shadow across its own tile.
   */
  function inkMaterial(): MeshStandardMaterial {
    const material = new MeshStandardMaterial({
      map: currentAtlas.ink,
      color: currentPalette.user.clone(),
      transparent: true,
      roughness: 0.4,
      metalness: 0.06,
      depthWrite: false,
    });
    const relief = mono ? currentAtlas.relief : null;
    if (relief) {
      material.alphaMap = relief;
      material.alphaTest = 0.3;
      material.bumpMap = relief;
      material.bumpScale = 0.6;
      material.displacementMap = relief;
      material.displacementScale = 0.03;
    }
    return material;
  }

  function applyNotes(
    board: Group,
    objects: CellObjects,
    cell: CellVisual,
    x: number,
    y: number,
  ) {
    // Notes only show on a cell with no value, exactly as the DOM grid
    // rules, and a charging digit hides its own notes while it charges.
    const show = cell.value === null && cell.notes.length > 0;
    for (let slot = 0; slot < 9; slot++) {
      const digit = cell.notes[slot];
      const existing = objects.notes[slot];
      if (!show || digit === undefined) {
        if (existing) existing.visible = false;
        continue;
      }
      let mesh = existing;
      if (!mesh) {
        mesh = new Mesh(geometry(String(slot + 1), NOTE_SIZE), noteMaterial);
        mesh.userData.slot = slot;
        objects.notes[slot] = mesh;
        board.add(mesh);
      }
      mesh.visible = true;
      mesh.material = cell.charging ? chargingMaterial : noteMaterial;
      mesh.position.set(
        x + noteOffset(digit - 1) * TILE,
        y - noteRowOffset(Math.floor((digit - 1) / 3)) * TILE,
        TILE_DEPTH + 0.015,
      );
    }
  }

  return {
    chargingMaterial,
    isCharging: (mesh) => mesh.material === chargingMaterial,
    ensureValue(board, objects, symbol) {
      const existing = objects.value;
      if (existing) {
        if (existing.userData.symbol !== symbol) {
          existing.userData.symbol = symbol;
          existing.geometry = geometry(symbol, VALUE_SIZE);
        }
        return existing;
      }
      const material = inkMaterial();
      const mesh = new Mesh(geometry(symbol, VALUE_SIZE), material);
      mesh.userData.symbol = symbol;
      mesh.castShadow = mono;
      objects.value = mesh;
      objects.valueMaterial = material;
      board.add(mesh);
      return mesh;
    },
    ensureSwatch(board, objects, given) {
      const existing = objects.swatch;
      if (existing) {
        const wanted = given ? swatchGeometry : discGeometry;
        if (existing.geometry !== wanted) existing.geometry = wanted;
        return existing;
      }
      const material = new MeshStandardMaterial({
        color: currentPalette.user.clone(),
        roughness: 0.5,
        metalness: 0.05,
      });
      const mesh = new Mesh(given ? swatchGeometry : discGeometry, material);
      mesh.castShadow = true;
      objects.swatch = mesh;
      objects.swatchMaterial = material;
      board.add(mesh);
      return mesh;
    },
    applyConflictRing(objects, cell, palette) {
      let ring = objects.conflictRing;
      if (!ring) {
        ring = new Mesh(
          conflictRingGeometry,
          new MeshStandardMaterial({
            color: palette.conflict,
            emissive: palette.conflict,
            emissiveIntensity: 0.5,
            transparent: true,
            depthWrite: false,
          }),
        );
        objects.conflictRing = ring;
        // The ring is a child of the swatch, so it rides every lift and
        // tilt the swatch takes without a second bookkeeping step.
        objects.swatch!.add(ring);
      }
      ring.position.set(0, 0, 0.04);
      ring.visible = cell.ink === "conflict";
    },
    applyNotes,
    setAtlas(atlas2, nextMono, cells) {
      currentAtlas = atlas2;
      mono = nextMono;
      geometries.clear();
      for (const material of [noteMaterial, chargingMaterial]) {
        material.map = atlas2.ink;
        material.alphaMap = nextMono ? atlas2.relief : null;
        material.needsUpdate = true;
      }
      for (const objects of cells) {
        const value = objects.value;
        const material = objects.valueMaterial;
        if (value && material) {
          material.map = atlas2.ink;
          const relief = nextMono ? atlas2.relief : null;
          material.alphaMap = relief;
          material.bumpMap = relief;
          material.displacementMap = relief;
          material.needsUpdate = true;
          value.geometry = geometry(
            value.userData.symbol as string,
            VALUE_SIZE,
          );
          value.castShadow = nextMono;
        }
        for (const [slot, note] of objects.notes.entries()) {
          if (note) note.geometry = geometry(String(slot + 1), NOTE_SIZE);
        }
      }
    },
    setPalette(next) {
      currentPalette = next;
      noteMaterial.color.copy(next.note);
      chargingMaterial.color.copy(next.accentBright);
      chargingMaterial.emissive.copy(next.accentBright);
    },
    dispose() {
      for (const cached of geometries.values()) cached.dispose();
      discGeometry.dispose();
      swatchGeometry.dispose();
      conflictRingGeometry.dispose();
      noteMaterial.dispose();
      chargingMaterial.dispose();
    },
  };
}
