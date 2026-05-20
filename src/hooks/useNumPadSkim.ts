import { useCallback, useEffect, useRef, useState } from "react";
import { haptics } from "../lib/haptics.ts";

type Options = {
  /** Highlights the digit the finger has skimmed onto. */
  onSkimDigit?: ((n: number) => void) | undefined;
  /** Fires when the skim gesture ends (pointerup/cancel). */
  onPressEnd?: (() => void) | undefined;
  /** Drives the numpad's pressed-digit visual as the finger skims. */
  setPressedDigit: (digit: number | null) => void;
};

/**
 * Tracks an along-axis numpad skim. Once a press has been classified as
 * a skim, the digit buttons' own pointer handlers can no longer see the
 * finger — it has left their bounds — so document-level listeners take
 * over and follow it across the row, highlighting whichever digit it
 * currently covers.
 */
export function useNumPadSkim({
  onSkimDigit,
  onPressEnd,
  setPressedDigit,
}: Options) {
  // Active skim gesture id; the effect below attaches doc listeners.
  const [skimPointerId, setSkimPointerId] = useState<number | null>(null);
  // Last digit the finger was over while skimming. Seeded to the
  // originally pressed digit so we don't re-fire onSkimDigit before the
  // finger crosses into a different button.
  const skimDigitRef = useRef<number | null>(null);
  // Keep the latest callbacks fresh for the document listeners without
  // re-binding them every render.
  const onSkimDigitRef = useRef(onSkimDigit);
  const onPressEndRef = useRef(onPressEnd);
  const setPressedDigitRef = useRef(setPressedDigit);
  onSkimDigitRef.current = onSkimDigit;
  onPressEndRef.current = onPressEnd;
  setPressedDigitRef.current = setPressedDigit;

  /** Arms skim tracking for `digit` under `pointerId`. */
  const beginSkim = useCallback((digit: number, pointerId: number) => {
    skimDigitRef.current = digit;
    setSkimPointerId(pointerId);
  }, []);

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
  }, [skimPointerId]);

  return { beginSkim };
}
