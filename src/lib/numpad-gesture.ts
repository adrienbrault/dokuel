import type { NumPadPosition, Position } from "./types.ts";

/**
 * The geometry of a digit gesture: when a pan has moved far enough to
 * mean something, which gesture it means, where the pad's board-facing
 * edge is, and which cell — and which half of it — a carried digit is
 * aimed at. Pure — the recognizer hook owns the state machine, this
 * file owns the arithmetic and the two hit-tests it consults.
 */

/** How long a press must be held before it means "pencil a note". */
export const HOLD_MS = 200;

// Pointer must travel this far FROM THE POINTERDOWN POINT before we
// classify the gesture (skim vs. drag). Never measure from the button
// center: an off-center click would start "past the threshold", and a
// few pixels of mouse wobble then misfired a drag/skim.
const SLOP_PX = 12;
// Half-angle of the drag cone — the wedge pointing perpendicular to the
// numpad, toward the board. A pan within this many degrees of that axis
// reads as a drag-to-place; a wider pan reads as an along-axis skim.
// The 60° cone (±30°) keeps a diagonal flick toward a neighbouring
// digit on the skim side rather than misfiring a drag.
const DRAG_CONE_HALF_ANGLE_DEG = 30;
const DRAG_CONE_SLOPE = Math.tan((DRAG_CONE_HALF_ANGLE_DEG * Math.PI) / 180);

/**
 * What a pan of (dx, dy) from the press point means, or null to keep
 * waiting while the pan is still inside the slop.
 *
 * A pan aimed within the drag cone — close to perpendicular to the pad,
 * toward the board — is a drag-to-place; a wider pan is an along-axis
 * skim, which falls back to a drag where no skim is recognized. A drag
 * always is: the recognizer that asks this owns the drop.
 */
export function classifyPan({
  dx,
  dy,
  position,
  skimEnabled,
}: {
  dx: number;
  dy: number;
  position: NumPadPosition;
  skimEnabled: boolean;
}): "skim" | "drag" | null {
  if (dx * dx + dy * dy < SLOP_PX * SLOP_PX) return null;
  const isVertical = position === "left" || position === "right";
  const along = isVertical ? Math.abs(dy) : Math.abs(dx);
  const perp = isVertical ? Math.abs(dx) : Math.abs(dy);
  if (along < perp * DRAG_CONE_SLOPE) return "drag";
  return skimEnabled ? "skim" : "drag";
}

/**
 * The digit button under a viewport point, or null when the point is
 * off the digit row. Digit buttons are found by their
 * `data-numpad-digit` attribute, so anything the pad renders inside a
 * key (faces, note previews, counts) still resolves to its button.
 */
export function digitButtonAt(x: number, y: number): HTMLButtonElement | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  return el.closest("[data-numpad-digit]") as HTMLButtonElement | null;
}

/**
 * The digit a skim should move onto for a button the finger is over, or
 * null to leave the skim where it is. Disabled (completed) digits are
 * visually hidden, so flashing them as the finger drifts past would
 * surprise the player.
 */
export function skimDigitOf(button: HTMLButtonElement | null): number | null {
  if (!button || button.disabled) return null;
  const digit = Number(button.dataset.numpadDigit);
  return Number.isNaN(digit) ? null : digit;
}

/**
 * True once the pointer has crossed the numpad's board-facing edge — the
 * top edge for a bottom numpad, the inner side for a left/right one.
 */
function crossedTowardBoard(
  rect: DOMRect,
  position: NumPadPosition,
  x: number,
  y: number,
): boolean {
  if (position === "left") return x >= rect.right;
  if (position === "right") return x <= rect.left;
  return y <= rect.top;
}

/**
 * The digit a skim should hand off to a drag, or null to keep skimming.
 * The handoff fires once the finger slides off the digit row toward the
 * board, carrying whichever digit it last settled on.
 */
export function skimHandoffDigit(
  overButton: boolean,
  group: HTMLElement | null,
  skimDigit: number | null,
  position: NumPadPosition,
  x: number,
  y: number,
): number | null {
  if (overButton || !group || skimDigit === null) return null;
  return crossedTowardBoard(group.getBoundingClientRect(), position, x, y)
    ? skimDigit
    : null;
}

/**
 * Which slot in the cell receives the dropped digit. The cell is
 * split horizontally: aim for the top half to commit the value, the
 * bottom half to add a note. A single drag gesture expresses both
 * intents without switching modes mid-drag.
 */
export type DigitDropMode = "value" | "note";

/** The cell a carried digit is aimed at, and the slot within it. */
export type CellHit = { position: Position; mode: DigitDropMode };

/**
 * Upward offset applied to a touch drag, in CSS pixels. A fingertip
 * occludes the cell directly underneath it, so the hit point — and
 * the chip — are raised clear of the hand. Mouse and pen are precise
 * pointers that occlude nothing, so they get no lift: the chip sits
 * right at the cursor.
 */
const TOUCH_LIFT_PX = 46;

export function liftForPointerType(pointerType: string): number {
  return pointerType === "touch" ? TOUCH_LIFT_PX : 0;
}

function cellModeAt(cell: HTMLElement, y: number): DigitDropMode {
  const rect = cell.getBoundingClientRect();
  if (rect.height <= 0) return "value";
  // Horizontal split at the cell's midline: the upper half is the
  // value zone, the lower half is the note zone. Top sits closer to
  // where the pointer enters from above on a numpad drag, which
  // matches the dominant "commit the digit" intent.
  const localY = (y - rect.top) / rect.height;
  return localY < 0.5 ? "value" : "note";
}

/**
 * The board cell a lifted pointer is aimed at, and which half of it, or
 * null when the aim point is off the grid. Cells are found by their
 * `data-row`/`data-col` attributes, so anything a cell renders inside
 * itself still resolves to the cell.
 */
export function cellHitFromPoint(
  pointerX: number,
  pointerY: number,
  lift: number,
): CellHit | null {
  const x = pointerX;
  const y = pointerY - lift;
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const btn = (el as HTMLElement).closest?.("[data-row]") as HTMLElement | null;
  if (!btn) return null;
  const row = Number(btn.dataset.row);
  const col = Number(btn.dataset.col);
  if (Number.isNaN(row) || Number.isNaN(col)) return null;
  return { position: { row, col }, mode: cellModeAt(btn, y) };
}
