import { type PointerEvent, useCallback, useRef } from "react";
import { DIGITS } from "../lib/constants.ts";
import { haptics } from "../lib/haptics.ts";
import type { NumPadPosition } from "../lib/types.ts";

const LONG_PRESS_MS = 400;

type NumPadProps = {
  position: NumPadPosition;
  remainingCounts: Record<number, number>;
  selectedValue?: number | null | undefined;
  showRemainingCounts?: boolean | undefined;
  disableCompleted?: boolean | undefined;
  /**
   * Fires the moment a digit is pressed (pointerdown) so the cell can
   * show an instant note. In Dokuel this writes a NOTE.
   */
  onNumber: (n: number) => void;
  /**
   * Fires after holding for LONG_PRESS_MS. In Dokuel this COMMITS a
   * value (overwriting the just-placed note).
   */
  onLongPressNumber?: ((n: number) => void) | undefined;
  /**
   * Fires on pointerup / cancel / leave — i.e. the press ended,
   * regardless of whether it crossed the long-press threshold. Used
   * by the parent to clear "currently charging" UI state.
   */
  onPressEnd?: (() => void) | undefined;
};

export function NumPad({
  position,
  remainingCounts,
  selectedValue,
  showRemainingCounts = true,
  disableCompleted = false,
  onNumber,
  onLongPressNumber,
  onPressEnd,
}: NumPadProps) {
  const isVertical = position === "left" || position === "right";

  const pressRef = useRef<{
    digit: number;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  // Suppress the synthetic click that follows pointerdown→pointerup so
  // onNumber doesn't double-fire. A fresh pointerdown clears it.
  const pointerFiredRef = useRef(false);

  const cancelTimer = useCallback(() => {
    if (pressRef.current?.timer) {
      clearTimeout(pressRef.current.timer);
      pressRef.current.timer = null;
    }
  }, []);

  const handlePointerDown = useCallback(
    (n: number) => (e: PointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      cancelTimer();
      pointerFiredRef.current = true;
      onNumber(n); // instant
      if (!onLongPressNumber) {
        pressRef.current = { digit: n, timer: null };
        return;
      }
      const timer = setTimeout(() => {
        if (pressRef.current) pressRef.current.timer = null;
        haptics.tap();
        onLongPressNumber(n);
      }, LONG_PRESS_MS);
      pressRef.current = { digit: n, timer };
    },
    [onNumber, onLongPressNumber, cancelTimer],
  );

  const handlePointerEnd = useCallback(() => {
    if (!pressRef.current) return;
    cancelTimer();
    pressRef.current = null;
    onPressEnd?.();
  }, [cancelTimer, onPressEnd]);

  const handleClick = useCallback(
    (n: number) => () => {
      if (pointerFiredRef.current) {
        pointerFiredRef.current = false;
        return;
      }
      // Keyboard/AT activation: no pointer events fired, so honor click.
      onNumber(n);
    },
    [onNumber],
  );

  return (
    <div
      className={`flex items-center gap-1 ${isVertical ? "flex-col w-12" : "flex-col w-full max-w-lg"} lg:flex-col lg:w-14`}
    >
      {/* Horizontal one-liner: only on mobile bottom position (room to fit) */}
      {!isVertical && (
        <p
          className="text-[0.625rem] text-text-muted leading-tight select-none lg:hidden"
          aria-hidden="true"
        >
          tap = note · hold = enter
        </p>
      )}
      {/* Stacked variant: mobile side-positioned numpads, and always on desktop */}
      <p
        className={`text-[0.625rem] text-text-muted leading-tight select-none text-center ${
          isVertical ? "" : "hidden lg:block"
        }`}
        aria-hidden="true"
      >
        tap
        <br />
        note
        <br />· · ·
        <br />
        hold
        <br />
        enter
      </p>
      <div
        className={`flex gap-1 lg:flex-col lg:w-14 ${isVertical ? "flex-col" : "flex-row justify-center"} ${isVertical ? "w-12" : "w-full max-w-lg lg:w-14"}`}
        role="group"
        aria-label="Number pad"
      >
        {DIGITS.map((n) => {
          const remaining = remainingCounts[n];
          const isComplete = remaining === 0;
          const isSelected = selectedValue === n;

          return (
            <button
              key={n}
              type="button"
              disabled={(showRemainingCounts || disableCompleted) && isComplete}
              className={`relative flex flex-col items-center justify-center rounded-lg select-none touch-manipulation font-semibold lg:h-10 lg:w-14 ${isVertical ? "h-11 w-12" : "h-14 flex-1 max-w-14"} ${(showRemainingCounts || disableCompleted) && isComplete ? "invisible" : "press-spring"} ${isSelected ? "bg-accent text-text-on-accent shadow-md" : "bg-bg-raised text-text-primary active:bg-accent active:text-text-on-accent active:shadow-md"}`}
              onPointerDown={handlePointerDown(n)}
              onPointerUp={handlePointerEnd}
              onPointerLeave={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onClick={handleClick(n)}
              aria-label={
                showRemainingCounts
                  ? `${n}, ${remaining} remaining${isSelected ? ", selected" : ""}`
                  : `${n}${isSelected ? ", selected" : ""}`
              }
            >
              <span className="text-lg leading-none">{n}</span>
              {showRemainingCounts && (
                <span
                  className={`text-[0.625rem] leading-none mt-0.5 ${isComplete ? "invisible" : isSelected ? "text-text-on-accent/70" : "text-text-secondary"}`}
                >
                  {remaining}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
