import type { DigitDragState } from "../hooks/useDigitDrag.ts";

const POINTER_LIFT_PX = 40;
const CHIP_SIZE_PX = 34;

type Props = {
  state: DigitDragState | null;
};

/**
 * The dragged digit, rendered as a small chip that always tracks the
 * pointer in real-time, lifted a fixed offset above it so the user's
 * finger doesn't occlude the cell it's aiming at. The chip itself
 * encodes only the validity of the current drop: green when the
 * pointer is over a droppable cell (or empty space), red when over a
 * cell that can't accept the digit. Which half of the cell the drop
 * lands in is communicated by the cell's own radial-glow halves, not
 * by snapping the chip into a slot — the indicator stays a cursor.
 */
export function DigitDragIndicator({ state }: Props) {
  if (!state) return null;

  const isInvalid = state.target !== null && state.invalidTarget;
  const pose: "free" | "invalid" = isInvalid ? "invalid" : "free";

  return (
    <div
      data-testid="digit-drag-indicator"
      data-pose={pose}
      aria-hidden="true"
      className={`fixed z-50 pointer-events-none select-none flex items-center justify-center font-bold rounded-md shadow-lg ${
        isInvalid
          ? "bg-cell-conflict-bg text-cell-conflict shadow-cell-conflict/40"
          : "bg-accent text-text-on-accent shadow-accent/40"
      }`}
      style={{
        left: state.x,
        top: state.y - POINTER_LIFT_PX,
        width: CHIP_SIZE_PX,
        height: CHIP_SIZE_PX,
        fontSize: CHIP_SIZE_PX * 0.62,
        transform: "translate(-50%, -50%)",
        transition: "background-color 0.12s ease, color 0.12s ease",
        lineHeight: 1,
      }}
    >
      {state.digit}
    </div>
  );
}
