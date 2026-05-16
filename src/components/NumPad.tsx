import { type PointerEvent, useCallback, useRef, useState } from "react";
import { DIGITS } from "../lib/constants.ts";
import { haptics } from "../lib/haptics.ts";
import type { NumPadPosition } from "../lib/types.ts";

// Must match the duration of `.animate-longpress-charge` in index.css —
// the scale-and-halo animation is the visible cue for this timer.
const LONG_PRESS_MS = 400;

type NumPadProps = {
  position: NumPadPosition;
  remainingCounts: Record<number, number>;
  selectedValue?: number | null | undefined;
  showRemainingCounts?: boolean | undefined;
  disableCompleted?: boolean | undefined;
  /** Short tap on a digit. In Dokuel this writes a NOTE. */
  onNumber: (n: number) => void;
  /** Long press on a digit. In Dokuel this COMMITS a value. */
  onLongPressNumber?: ((n: number) => void) | undefined;
};

export function NumPad({
  position,
  remainingCounts,
  selectedValue,
  showRemainingCounts = true,
  disableCompleted = false,
  onNumber,
  onLongPressNumber,
}: NumPadProps) {
  const isVertical = position === "left" || position === "right";

  const [pressingDigit, setPressingDigit] = useState<number | null>(null);
  const pressRef = useRef<{
    digit: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  // Carries "long-press just fired" across pointerup→click so we can
  // suppress the synthetic click that would otherwise fire onNumber.
  const firedRef = useRef(false);

  const cancelPress = useCallback(() => {
    if (pressRef.current) {
      clearTimeout(pressRef.current.timer);
      pressRef.current = null;
    }
    setPressingDigit(null);
  }, []);

  const handlePointerDown = useCallback(
    (n: number) => (e: PointerEvent<HTMLButtonElement>) => {
      if (!onLongPressNumber) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      cancelPress();
      firedRef.current = false;
      const timer = setTimeout(() => {
        firedRef.current = true;
        pressRef.current = null;
        setPressingDigit(null);
        haptics.tap();
        onLongPressNumber(n);
      }, LONG_PRESS_MS);
      pressRef.current = { digit: n, timer };
      setPressingDigit(n);
    },
    [onLongPressNumber, cancelPress],
  );

  const handleClick = useCallback(
    (n: number) => () => {
      if (firedRef.current) {
        firedRef.current = false;
        return;
      }
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
          const isPressing = pressingDigit === n;

          return (
            <button
              key={n}
              type="button"
              disabled={(showRemainingCounts || disableCompleted) && isComplete}
              className={`relative flex flex-col items-center justify-center rounded-lg select-none touch-manipulation font-semibold lg:h-10 lg:w-14 ${isVertical ? "h-11 w-12" : "h-14 flex-1 max-w-14"} ${(showRemainingCounts || disableCompleted) && isComplete ? "invisible" : "press-spring"} ${isPressing ? "animate-longpress-charge" : ""} ${isSelected ? "bg-accent text-text-on-accent shadow-md" : "bg-bg-raised text-text-primary active:bg-accent active:text-text-on-accent active:shadow-md"}`}
              onPointerDown={
                onLongPressNumber ? handlePointerDown(n) : undefined
              }
              onPointerUp={onLongPressNumber ? cancelPress : undefined}
              onPointerLeave={onLongPressNumber ? cancelPress : undefined}
              onPointerCancel={onLongPressNumber ? cancelPress : undefined}
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
