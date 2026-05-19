import type { DigitDragState } from "../hooks/useDigitDrag.ts";

const CHIP_SIZE_PX = 34;

type Props = {
  state: DigitDragState | null;
};

/**
 * The dragged digit, rendered as a small chip that tracks the pointer
 * in real-time. On touch it's lifted clear of the fingertip (so the
 * finger doesn't occlude the cell being aimed at); on mouse/pen the
 * lift is zero and the chip sits right at the cursor.
 *
 * The chip is a transit cursor, not a preview. Once the pointer is
 * over a valid cell, that cell draws its own two landing previews —
 * so the chip fades out to keep attention on a single surface. It
 * stays visible (green) while in transit over empty space, and turns
 * red over a cell that can't accept the digit.
 */
export function DigitDragIndicator({ state }: Props) {
  if (!state) return null;

  const isInvalid = state.target !== null && state.invalidTarget;
  const isOverValid = state.target !== null && !state.invalidTarget;
  const pose: "free" | "invalid" | "hidden" = isInvalid
    ? "invalid"
    : isOverValid
      ? "hidden"
      : "free";

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
        top: state.y - state.lift,
        width: CHIP_SIZE_PX,
        height: CHIP_SIZE_PX,
        fontSize: CHIP_SIZE_PX * 0.62,
        opacity: pose === "hidden" ? 0 : 1,
        transform: `translate(-50%, -50%) scale(${pose === "hidden" ? 0.6 : 1})`,
        transition:
          "opacity 0.15s ease, transform 0.15s ease, background-color 0.12s ease, color 0.12s ease",
        lineHeight: 1,
      }}
    >
      {state.digit}
    </div>
  );
}
