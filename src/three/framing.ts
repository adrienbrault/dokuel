import type { PerspectiveCamera } from "three";
import type { CellHit } from "../lib/pointer-cell.ts";
import { clamp01 } from "./easing.ts";
import {
  axis,
  BOARD_SPAN,
  cameraDistance,
  cellPosition,
  framingHeight,
  TILE,
  TILE_DEPTH,
} from "./layout.ts";

/** Half-angle of the board's field of view, in radians. */
const HALF_FOV_RAD = (15 * Math.PI) / 180;
/** The board is framed with a narrow field of view, so its face reads flat. */
export const FOV = 30;

/**
 * Frames the board so its tiles land on the pixels the CSS grid would
 * have used, and returns the distance that achieves it.
 *
 * The visible height comes from the board's own box rather than the
 * canvas, because the canvas is square and the board is meant to fill
 * it: deriving the span from the canvas would let the grid drift as the
 * page layout changes.
 */
export function fitCamera(
  camera: PerspectiveCamera,
  canvasWidth: number,
  canvasHeight: number,
  boardPx: number,
): number {
  camera.aspect = canvasWidth / canvasHeight;
  camera.updateProjectionMatrix();
  const visible = framingHeight(BOARD_SPAN, canvasHeight, boardPx);
  return cameraDistance(visible, FOV);
}

/** Normalised device coordinates for a client point inside a canvas. */
export function toNdc(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -((clientY - rect.top) / rect.height) * 2 + 1,
  };
}

/**
 * Resolves a client point to the cell under it.
 *
 * The board is axis aligned and the camera only tilts a fraction of a
 * degree, so the ray can be solved against the tile plane in closed
 * form rather than raycasting eighty-one meshes on every pointer move.
 * Solving it against the plane rather than against a screen-space grid
 * is what lets the camera tilt at all: a fixed mapping would forbid
 * more than a third of a degree before a cell's edges moved a visible
 * fraction of its width.
 */
export function resolveCellHit(
  camera: PerspectiveCamera,
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): CellHit | null {
  const ndc = toNdc(rect, clientX, clientY);
  if (!ndc) return null;

  // The ray is shortened to the depth of the tile faces, not the board's
  // centre, so a lifted tile stays under the pointer that lifted it.
  const distance = camera.position.z - TILE_DEPTH / 2;
  const spanY = 2 * Math.tan(HALF_FOV_RAD) * camera.position.z;
  const shorten = distance / camera.position.z;
  const worldX =
    camera.position.x + ((ndc.x * spanY * camera.aspect) / 2) * shorten;
  const worldY = camera.position.y + ((ndc.y * spanY) / 2) * shorten;

  const col = nearestAxis(worldX, (v) => v);
  const row = nearestAxis(worldY, (v) => -v);
  if (col === null || row === null) return null;
  const [, cellY] = cellPosition(row, col);
  // The upper half of a tile takes a value, the lower half a note,
  // matching how the DOM grid splits a cell on a vertical drag.
  return { row, col, localY: clamp01(0.5 - (worldY - cellY) / TILE) };
}

/** Closest grid line to a world coordinate, rejecting a miss. */
function nearestAxis(
  value: number,
  flip: (v: number) => number,
): number | null {
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 9; i++) {
    const distance = Math.abs(flip(axis(i)) - value);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return bestDistance <= TILE / 2 ? best : null;
}
