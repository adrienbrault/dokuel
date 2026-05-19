import { useEffect, useState } from "react";
import type { DigitDragState } from "../hooks/useDigitDrag.ts";

const POINTER_LIFT_PX = 40;
const FREE_SIZE_PX = 28;

type Pose = "intro" | "free" | "value" | "note";

type Placement = {
  cx: number;
  cy: number;
  size: number;
  digitFraction: number;
  pose: Pose;
};

function getCellRect(row: number, col: number): DOMRect | null {
  const el = document.querySelector<HTMLElement>(
    `[data-row="${row}"][data-col="${col}"]`,
  );
  return el ? el.getBoundingClientRect() : null;
}

function computePlacement(state: DigitDragState, intro: boolean): Placement {
  const free: Placement = {
    cx: state.x,
    cy: state.y - POINTER_LIFT_PX,
    size: FREE_SIZE_PX,
    digitFraction: 0.68,
    pose: "free",
  };

  // Intro frame: anchor at the source cell so the digit appears to
  // lift out of its slot toward the pointer on the next frame.
  // Numpad drags skip this — they have no source cell to lift from.
  if (intro && state.source.kind === "cell") {
    const rect = getCellRect(state.source.row, state.source.col);
    if (rect) {
      return {
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
        size: rect.width,
        digitFraction: 0.55,
        pose: "intro",
      };
    }
  }

  if (!state.target || state.invalidTarget) return free;

  const rect = getCellRect(state.target.row, state.target.col);
  if (!rect) return free;

  if (state.mode === "value") {
    return {
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
      size: rect.width,
      digitFraction: 0.55,
      pose: "value",
    };
  }

  // Note pose: digit moves to its own sub-cell so the user sees
  // exactly which sub-cell will receive the note on release.
  const subW = rect.width / 3;
  const subH = rect.height / 3;
  const noteRow = Math.floor((state.digit - 1) / 3);
  const noteCol = (state.digit - 1) % 3;
  return {
    cx: rect.left + (noteCol + 0.5) * subW,
    cy: rect.top + (noteRow + 0.5) * subH,
    size: subW,
    digitFraction: 0.68,
    pose: "note",
  };
}

type Props = {
  state: DigitDragState | null;
};

/**
 * The dragged digit, rendered as a single floating element that
 * smoothly morphs between four poses:
 *   - intro: anchored at the source cell on the first frame after
 *     drag-start, so the digit appears to lift out of its slot
 *   - free: small cursor-sized chip following the pointer
 *   - value: sized and centered to match the slot the digit would
 *     land in if released over the value zone
 *   - note: sized to a note sub-cell and positioned at the digit's
 *     own sub-cell within the target
 *
 * The position itself previews the drop — no separate in-cell digit
 * is needed; the hovered cell only shows the diagonal zone tints.
 */
export function DigitDragIndicator({ state }: Props) {
  const [intro, setIntro] = useState(true);

  useEffect(() => {
    if (state === null) {
      setIntro(true);
      return;
    }
    if (!intro) return;
    // After the first paint of the intro pose, flip to "active" so
    // the CSS transition animates from source-cell to free/target.
    const id = requestAnimationFrame(() => setIntro(false));
    return () => cancelAnimationFrame(id);
  }, [state, intro]);

  if (!state) return null;

  const p = computePlacement(state, intro);
  const isChip = p.pose === "free";

  return (
    <div
      data-testid="digit-drag-indicator"
      data-pose={p.pose}
      aria-hidden="true"
      className={`fixed z-50 pointer-events-none select-none flex items-center justify-center font-bold rounded-md ${
        isChip
          ? "bg-accent text-text-on-accent shadow-lg shadow-accent/40"
          : "bg-transparent text-cell-user"
      }`}
      style={{
        left: p.cx,
        top: p.cy,
        width: p.size,
        height: p.size,
        fontSize: p.size * p.digitFraction,
        transform: "translate(-50%, -50%)",
        transition:
          "left 0.14s cubic-bezier(0.4, 0, 0.2, 1), top 0.14s cubic-bezier(0.4, 0, 0.2, 1), width 0.14s cubic-bezier(0.4, 0, 0.2, 1), height 0.14s cubic-bezier(0.4, 0, 0.2, 1), font-size 0.14s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.14s ease, color 0.14s ease",
        lineHeight: 1,
      }}
    >
      {state.digit}
    </div>
  );
}
