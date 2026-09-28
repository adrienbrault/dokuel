import { Color } from "three";
import type { BoardPalette } from "./palette.ts";
import type { CellVisual, SceneSnapshot } from "./scene-state.ts";

/** Tile lift per visual state, in cell units. */
const LIFT: Record<CellVisual["state"], number> = {
  idle: 0,
  highlight: 0.02,
  matchRowCol: 0.02,
  same: 0.05,
  hint: 0.12,
  conflict: 0.04,
  selected: 0.2,
};

/** Tile emissive glow per visual state. */
const GLOW: Record<CellVisual["state"], number> = {
  idle: 0,
  highlight: 0.04,
  matchRowCol: 0.04,
  same: 0.1,
  hint: 0.3,
  conflict: 0.22,
  selected: 0.26,
};

/** What a tile is aiming at this frame, before easing. */
export type CellTarget = {
  lift: number;
  glow: number;
  colour: Color;
  /** Brighter selection rim: a drop preview reads as more urgent. */
  dropPreview: boolean;
};

export function tileColour(state: CellVisual["state"], p: BoardPalette): Color {
  switch (state) {
    case "selected":
      return p.selected;
    case "highlight":
      return p.highlight;
    case "matchRowCol":
      return p.band;
    case "same":
      return p.same;
    case "hint":
      return p.hint;
    case "conflict":
      return p.conflictBg;
    default:
      return p.cell;
  }
}

/**
 * Ink colour for a glyph.
 *
 * In "digits" mode a colour always names a digit, so a conflict keeps
 * its hue - the ring around a swatch, or the glyph's own glow, carries
 * the conflict instead. Emoji glyphs are painted into their texture, so
 * they must not be tinted.
 */
export function inkColour(
  cell: CellVisual,
  p: BoardPalette,
  mode: SceneSnapshot["digitMode"],
): Color {
  if (mode === "emoji") return new Color(1, 1, 1);
  if (mode === "digits" && cell.value !== null)
    return p.digits[cell.value - 1]!;
  if (cell.ink === "conflict") return p.conflict;
  if (cell.ink === "given") return p.given;
  return p.user;
}

/**
 * Combines a cell's visual state with whatever the pointer and the drag
 * are doing to it. A hover stacks on top of the state rather than
 * replacing it, so a hovered selection still reads as a selection.
 */
export function resolveCellTarget(
  cell: CellVisual,
  p: BoardPalette,
): CellTarget {
  let lift = LIFT[cell.state];
  let glow = GLOW[cell.state];
  let colour = tileColour(cell.state, p);
  let dropPreview = false;

  if (cell.hover) {
    lift += 0.05;
    glow = Math.max(glow, 0.1);
  }
  if (cell.dragSource) {
    lift += 0.32;
    glow = Math.max(glow, 0.34);
  }
  if (cell.dropTarget === "valid") {
    lift += 0.28;
    glow = Math.max(glow, 0.42);
    colour = p.selected;
    dropPreview = true;
  } else if (cell.dropTarget === "invalid") {
    colour = p.conflictBg;
    glow = Math.max(glow, 0.5);
  }

  return { lift, glow, colour, dropPreview };
}
