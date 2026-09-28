import {
  type Color,
  type Group,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createGlyphKit } from "./cell-glyphs.ts";
import { inkColour, resolveCellTarget } from "./cell-targets.ts";
import { approach, clamp01, easeOutCubic } from "./easing.ts";
import type { GlyphAtlas } from "./glyph-atlas.ts";
import { cellPosition, TILE_DEPTH } from "./layout.ts";
import type { BoardPalette } from "./palette.ts";
import type { CellVisual, SceneSnapshot } from "./scene-state.ts";

/** How long a digit springs after landing, in seconds. */
const POP_DURATION = 0.45;

export type CellObjects = {
  tile: Mesh;
  tileMaterial: MeshStandardMaterial;
  selectionRing: Mesh;
  selectionMaterial: MeshStandardMaterial;
  value: Mesh | null;
  valueMaterial: MeshStandardMaterial | null;
  swatch: Mesh | null;
  swatchMaterial: MeshStandardMaterial | null;
  conflictRing: Mesh | null;
  notes: (Mesh | null)[];
  selected: boolean;
  lift: number;
  glow: number;
  colour: Color;
  /** When a digit started springing, or -1 once it has settled. */
  popAt: number;
  /** When a given tile may rise, or -1 once it has. */
  revealAt: number;
  lastValue: number | null;
};

export type CellKitContext = {
  palette: BoardPalette;
  digitMode: SceneSnapshot["digitMode"];
  elapsed: number;
  /** Fires when a digit lands, so the caller can throw sparks. */
  onPlace(row: number, col: number, colour: Color): void;
};

export type CellKitFrame = {
  dt: number;
  elapsed: number;
  motion: boolean;
  /** Shared breathing factor for every selection, 0 to 1. */
  breathe: number;
  /** Extra lift from the completion wave, for a cell index. */
  celebrateLift(index: number): number;
};

export type CellKit = {
  cells: CellObjects[];
  apply(cells: CellVisual[], ctx: CellKitContext): void;
  ease(frame: CellKitFrame): void;
  setPalette(palette: BoardPalette): void;
  setAtlas(atlas: GlyphAtlas, mono: boolean): void;
  dispose(): void;
};

/**
 * The eighty-one tiles and everything standing on them.
 *
 * Targets are written by apply() and chased by ease(), rather than the
 * state being applied directly, because a tile that snaps to its new
 * colour in one frame reads as a repaint rather than as an object that
 * was touched.
 */
export function createCellKit(
  board: Group,
  palette: BoardPalette,
  atlas: GlyphAtlas,
): CellKit {
  const glyphs = createGlyphKit(atlas, palette);
  const tileGeometry = new RoundedBoxGeometry(1, 1, TILE_DEPTH, 3, 0.1);
  const selectionRingGeometry = new RingGeometry(0.5, 0.58, 48);

  const cells: CellObjects[] = [];
  for (let index = 0; index < 81; index++) {
    const row = Math.floor(index / 9);
    const col = index % 9;
    const [x, y] = cellPosition(row, col);

    const tileMaterial = new MeshStandardMaterial({
      color: palette.cell.clone(),
      roughness: 0.62,
      metalness: 0.02,
      emissive: palette.accent.clone(),
      emissiveIntensity: 0,
    });
    const tile = new Mesh(tileGeometry, tileMaterial);
    tile.position.set(x, y, TILE_DEPTH / 2);
    tile.receiveShadow = true;
    tile.castShadow = true;
    board.add(tile);

    const selectionMaterial = new MeshStandardMaterial({
      color: palette.accent,
      emissive: palette.accent,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    });
    const selectionRing = new Mesh(selectionRingGeometry, selectionMaterial);
    selectionRing.position.set(x, y, TILE_DEPTH + 0.004);
    selectionRing.visible = false;
    board.add(selectionRing);

    cells.push({
      tile,
      tileMaterial,
      selectionRing,
      selectionMaterial,
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
    });
  }

  function applyValue(
    objects: CellObjects,
    cell: CellVisual,
    value: number,
    x: number,
    y: number,
    ctx: CellKitContext,
  ) {
    const ink = inkColour(cell, ctx.palette, ctx.digitMode);
    if (ctx.digitMode === "colors") {
      if (objects.value) objects.value.visible = false;
      const swatch = glyphs.ensureSwatch(board, objects, cell.isGiven);
      swatch.visible = true;
      swatch.position.set(x, y, TILE_DEPTH + 0.02);
      objects.swatchMaterial!.color.copy(ctx.palette.digits[value - 1]!);
      glyphs.applyConflictRing(objects, cell, ctx.palette);
    } else {
      if (objects.swatch) objects.swatch.visible = false;
      const mesh = glyphs.ensureValue(
        board,
        objects,
        cell.emoji ?? String(value),
      );
      mesh.visible = true;
      mesh.position.set(x, y, TILE_DEPTH + 0.02);
      const material = objects.valueMaterial!;
      material.color.copy(ink);
      // Emoji are painted into their texture with their own colours, so
      // tinting them would flatten them, and tone mapping would shift
      // them away from the swatch the picker shows.
      material.toneMapped = ctx.digitMode !== "emoji";
      if (objects.conflictRing) objects.conflictRing.visible = false;
    }
    if (objects.lastValue !== value) {
      objects.popAt = ctx.elapsed;
      ctx.onPlace(cell.row, cell.col, ink);
    }
    objects.lastValue = value;
  }

  let firstApply = true;

  function apply(next: CellVisual[], ctx: CellKitContext) {
    next.forEach((cell, index) => {
      const objects = cells[index]!;
      const [x, y] = cellPosition(cell.row, cell.col);
      const target = resolveCellTarget(cell, ctx.palette);
      objects.lift = target.lift;
      objects.glow = target.glow;
      objects.colour.copy(target.colour);
      objects.selected = cell.state === "selected";

      const drop = target.dropPreview;
      objects.selectionRing.visible = objects.selected || drop;
      objects.selectionRing.position.set(
        x,
        y,
        TILE_DEPTH + 0.004 + target.lift,
      );
      objects.selectionMaterial.opacity = drop
        ? 0.9
        : objects.selected
          ? 0.5
          : 0;
      objects.selectionMaterial.color.copy(
        drop ? ctx.palette.accentBright : ctx.palette.accent,
      );
      objects.selectionMaterial.emissive.copy(objects.selectionMaterial.color);

      const value = cell.value;
      if (value !== null) {
        applyValue(objects, cell, value, x, y, ctx);
      } else {
        if (objects.value) objects.value.visible = false;
        if (objects.swatch) objects.swatch.visible = false;
        if (objects.conflictRing) objects.conflictRing.visible = false;
        objects.lastValue = null;
      }
      glyphs.applyNotes(board, objects, cell, x, y);

      // The given-reveal wave runs once when the board appears, so tiles
      // rise in reading order instead of all at once.
      if (firstApply && objects.revealAt < 0 && cell.revealDelayMs !== null) {
        objects.revealAt = ctx.elapsed + cell.revealDelayMs / 1000;
      }
    });
    firstApply = false;
  }

  function ease(frame: CellKitFrame) {
    const poseBlend = approach(14, frame.dt);
    const colourBlend = approach(10, frame.dt);
    cells.forEach((objects, index) => {
      const revealed =
        objects.revealAt < 0 || frame.elapsed >= objects.revealAt;
      const lift = revealed ? objects.lift + frame.celebrateLift(index) : -0.7;
      objects.tile.position.z +=
        (TILE_DEPTH / 2 + lift - objects.tile.position.z) * poseBlend;
      objects.tileMaterial.color.lerp(objects.colour, colourBlend);
      // A selection breathes on one shared clock, matching the DOM board
      // where a single animation drives every selection's pulse at once.
      const glow = objects.glow + (objects.selected ? 0.3 * frame.breathe : 0);
      objects.tileMaterial.emissiveIntensity +=
        (glow - objects.tileMaterial.emissiveIntensity) * colourBlend;

      const value = objects.value;
      if (value) {
        const t =
          objects.popAt < 0
            ? 1
            : clamp01((frame.elapsed - objects.popAt) / POP_DURATION);
        const spring = frame.motion
          ? 1 + Math.sin(t * Math.PI) * 0.3 * (1 - t)
          : 1;
        value.scale.setScalar(spring * (revealed ? 1 : 0.01));
        value.rotation.z = frame.motion ? (1 - easeOutCubic(t)) * 0.45 : 0;
        if (t >= 1 && objects.popAt >= 0) objects.popAt = -1;
      }
      if (objects.swatch) objects.swatch.scale.setScalar(revealed ? 1 : 0.01);
      for (const note of objects.notes) {
        if (!note?.visible) continue;
        const beat =
          glyphs.isCharging(note) && frame.motion
            ? 1 + 0.16 * Math.sin(frame.elapsed * 7)
            : 1;
        note.scale.setScalar(beat * (revealed ? 1 : 0.01));
      }
    });
  }

  return {
    cells,
    apply,
    ease,
    setPalette(next) {
      glyphs.setPalette(next);
      for (const objects of cells) {
        objects.selectionMaterial.color.copy(next.accent);
        objects.selectionMaterial.emissive.copy(next.accent);
        objects.tileMaterial.emissive.copy(next.accent);
      }
    },
    setAtlas(atlas2, mono) {
      glyphs.setAtlas(atlas2, mono, cells);
    },
    dispose() {
      glyphs.dispose();
      tileGeometry.dispose();
      selectionRingGeometry.dispose();
      for (const objects of cells) {
        objects.tileMaterial.dispose();
        objects.selectionMaterial.dispose();
        objects.valueMaterial?.dispose();
        objects.swatchMaterial?.dispose();
        const ring = objects.conflictRing?.material as
          | MeshStandardMaterial
          | undefined;
        ring?.dispose();
      }
    },
  };
}
