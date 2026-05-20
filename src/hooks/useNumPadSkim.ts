import { useCallback, useEffect, useRef, useState } from "react";
import { haptics } from "../lib/haptics.ts";
import type { NumPadPosition } from "../lib/types.ts";

type DragStart = (args: {
  digit: number;
  x: number;
  y: number;
  pointerId: number;
  pointerType: string;
}) => void;

type Options = {
  /** Which edge of the screen the numpad sits on. */
  position: NumPadPosition;
  /** Highlights the digit the finger has skimmed onto. */
  onSkimDigit?: ((n: number) => void) | undefined;
  /** Fires when the skim gesture ends (pointerup/cancel). */
  onPressEnd?: (() => void) | undefined;
  /** Hands the gesture to the drag-and-drop layer, carrying `digit`. */
  onStartDrag?: DragStart | undefined;
  /** Drives the numpad's pressed-digit visual as the finger skims. */
  setPressedDigit: (digit: number | null) => void;
};

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
function skimHandoffDigit(
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
 * Tracks an along-axis numpad skim. Once a press has been classified as
 * a skim, the digit buttons' own pointer handlers can no longer see the
 * finger — it has left their bounds — so document-level listeners take
 * over and follow it across the row, highlighting whichever digit it
 * currently covers. Sliding the finger off the row toward the board
 * promotes the same gesture into a drag-to-place.
 */
export function useNumPadSkim({
  position,
  onSkimDigit,
  onPressEnd,
  onStartDrag,
  setPressedDigit,
}: Options) {
  // The digit-button row, used to detect when the finger has slid off
  // the numpad toward the board.
  const groupRef = useRef<HTMLDivElement>(null);
  // Active skim gesture id; the effect below attaches doc listeners.
  const [skimPointerId, setSkimPointerId] = useState<number | null>(null);
  // Last digit the finger was over while skimming. Seeded to the
  // originally pressed digit so we don't re-fire onSkimDigit before the
  // finger crosses into a different button.
  const skimDigitRef = useRef<number | null>(null);
  // pointerType of the active skim, needed to hand the gesture to a drag.
  const skimPointerTypeRef = useRef<string>("touch");
  // Keep the latest callbacks fresh for the document listeners without
  // re-binding them every render.
  const onSkimDigitRef = useRef(onSkimDigit);
  const onPressEndRef = useRef(onPressEnd);
  const onStartDragRef = useRef(onStartDrag);
  const setPressedDigitRef = useRef(setPressedDigit);
  onSkimDigitRef.current = onSkimDigit;
  onPressEndRef.current = onPressEnd;
  onStartDragRef.current = onStartDrag;
  setPressedDigitRef.current = setPressedDigit;

  /** Arms skim tracking for `digit` under the given pointer. */
  const beginSkim = useCallback(
    (digit: number, pointerId: number, pointerType: string) => {
      skimDigitRef.current = digit;
      skimPointerTypeRef.current = pointerType;
      setSkimPointerId(pointerId);
    },
    [],
  );

  useEffect(() => {
    if (skimPointerId === null) return;
    const ownPointerId = skimPointerId;

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== ownPointerId) return;
      e.preventDefault();
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const btn = el
        ? ((el as HTMLElement).closest?.(
            "[data-numpad-digit]",
          ) as HTMLButtonElement | null)
        : null;

      // The finger has slid off the digit row toward the board: promote
      // the skim into a drag-to-place, so a single continuous tap can
      // pick a digit and drop it onto a cell.
      const handoff = skimHandoffDigit(
        btn !== null,
        groupRef.current,
        skimDigitRef.current,
        position,
        e.clientX,
        e.clientY,
      );
      if (handoff !== null && onStartDragRef.current) {
        setSkimPointerId(null);
        skimDigitRef.current = null;
        setPressedDigitRef.current(null);
        haptics.tap();
        onStartDragRef.current({
          digit: handoff,
          x: e.clientX,
          y: e.clientY,
          pointerId: ownPointerId,
          pointerType: skimPointerTypeRef.current,
        });
        onPressEndRef.current?.();
        return;
      }

      // Skip disabled (completed) digits — they're visually hidden, so
      // briefly highlighting them as the finger drifts over their slot
      // would surprise the user.
      if (!btn || btn.disabled) return;
      const digit = Number(btn.dataset.numpadDigit);
      if (Number.isNaN(digit)) return;
      if (digit === skimDigitRef.current) return;
      skimDigitRef.current = digit;
      setPressedDigitRef.current(digit);
      haptics.light();
      onSkimDigitRef.current?.(digit);
    };

    const end = (e: PointerEvent) => {
      if (e.pointerId !== ownPointerId) return;
      setSkimPointerId(null);
      skimDigitRef.current = null;
      setPressedDigitRef.current(null);
      onPressEndRef.current?.();
    };

    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
    };
  }, [skimPointerId, position]);

  return { beginSkim, groupRef };
}
