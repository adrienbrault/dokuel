/**
 * Board geometry in world units.
 *
 * The WebGL board mirrors the DOM grid's proportions: nine cells per
 * row, a small gutter inside each box and a wider one between boxes.
 * One world unit is one cell, so every other size in the scene is
 * expressed relative to it and the whole board rescales with the
 * camera distance rather than with the layout.
 */

/** One cell of the grid. */
export const CELL = 1;
/** Gutter between two cells inside the same box. */
export const IN_BOX_GAP = 0.06;
/** Gutter between two boxes — deliberately wider than the inner one. */
export const BOX_GAP = 0.18;
/** A tile is slightly smaller than its cell, leaving a grout line. */
export const TILE = 0.94;
/** A given's relief is shallower than an entered digit's. */
export const TILE_DEPTH = 0.16;

/** Width of a 3×3 box, gutters included. */
export const BOX_WIDTH = 3 * CELL + 2 * IN_BOX_GAP;
/** Distance between the centres of two neighbouring boxes. */
export const BOX_PITCH = BOX_WIDTH + BOX_GAP;
/** Full width and height of the nine-by-nine grid. */
export const BOARD_SPAN = 3 * BOX_PITCH - BOX_GAP;

/**
 * Centre of the grid line at `index`, with the whole board centred on
 * the origin so the camera can look straight down the z axis.
 */
export function axis(index: number): number {
  const box = Math.floor(index / 3);
  const inBox = index % 3;
  const boxCentre = (box - 1) * BOX_PITCH;
  return boxCentre + (inBox - 1) * (CELL + IN_BOX_GAP);
}

/**
 * World position of a cell. WebGL's y grows upwards while the grid's
 * row index grows downwards, so the row axis is negated.
 */
export function cellPosition(row: number, col: number): [number, number] {
  return [axis(col), -axis(row)];
}

/** A pencil note occupies a third of its tile. */
export function noteSize(): number {
  return TILE / 3;
}

/** Offsets of the three note columns, left to right, in tile units. */
export function noteOffset(slot: number): number {
  return (slot - 1) / 3;
}

/**
 * Vertical position of a note slot. Notes fill a three-by-three sub-grid
 * across the whole tile, so the row offsets mirror the column ones — the
 * same layout the DOM sub-grid uses, where notes only show on a cell
 * that carries no value.
 */
export function noteRowOffset(row: number): number {
  return (row - 1) / 3;
}

/**
 * World height the camera must reveal so that `contentPx` of board fills
 * a `canvasPx` canvas. The DOM board leaves a little padding around
 * itself, and the tiles have to keep landing on the same pixels the CSS
 * grid would have used.
 */
export function framingHeight(
  worldSpan: number,
  canvasPx: number,
  contentPx: number,
): number {
  if (contentPx <= 0 || canvasPx <= 0) return worldSpan;
  return (worldSpan * canvasPx) / contentPx;
}

/** Camera distance that reveals `height` world units for a given fov. */
export function cameraDistance(height: number, fovDeg: number): number {
  const half = Math.tan(((fovDeg / 2) * Math.PI) / 180);
  return height / (2 * half);
}
