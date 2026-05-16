import { type PointerEvent, useCallback, useRef, useState } from "react";
import { DIGITS } from "../lib/constants.ts";
import { haptics } from "../lib/haptics.ts";
import type { NumPadPosition } from "../lib/types.ts";

// Must match the duration of `.animate-longpress-fill` in index.css —
// the fill animation is the visible cue for this timer.
const LONG_PRESS_MS = 400;

type NumPadProps = {
  position: NumPadPosition;
  remainingCounts: Record<number, number>;
  selectedValue?: number | null | undefined;
  showRemainingCounts?: boolean | undefined;
  disableCompleted?: boolean | undefined;
  onNumber: (n: number) => void;
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
  // suppress the synthetic click that would otherwise place a value.
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
      className={`
				flex gap-1 lg:flex-col lg:w-14
				${isVertical ? "flex-col" : "flex-row justify-center"}
				${isVertical ? "w-12" : "w-full max-w-lg lg:w-14"}
			`}
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
            className={`relative overflow-hidden flex flex-col items-center justify-center rounded-lg select-none touch-manipulation font-semibold lg:h-10 lg:w-14 ${isVertical ? "h-11 w-12" : "h-14 flex-1 max-w-14"} ${(showRemainingCounts || disableCompleted) && isComplete ? "invisible" : "press-spring"} ${isSelected ? "bg-accent text-text-on-accent shadow-md" : "bg-bg-raised text-text-primary active:bg-accent active:text-text-on-accent active:shadow-md"}`}
            onPointerDown={onLongPressNumber ? handlePointerDown(n) : undefined}
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
            {isPressing && (
              <span
                data-testid="longpress-progress"
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none animate-longpress-fill bg-amber-400/70 dark:bg-amber-300/60"
              />
            )}
            <span className="relative text-lg leading-none">{n}</span>
            {showRemainingCounts && (
              <span
                className={`relative text-[0.625rem] leading-none mt-0.5 ${isComplete ? "invisible" : isSelected ? "text-text-on-accent/70" : "text-text-secondary"}`}
              >
                {remaining}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
