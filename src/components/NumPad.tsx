import type { NumPadGesture } from "../hooks/useDigitGesture.ts";
import { DIGITS } from "../lib/constants.ts";
import type { NumPadPosition } from "../lib/types.ts";
import { NumPadKeyFace, numPadKeyLabel } from "./NumPadKeyFace.tsx";
import { NumPadLegend } from "./NumPadLegend.tsx";

type NumPadProps = {
  position: NumPadPosition;
  remainingCounts: Record<number, number>;
  selectedValue?: number | null | undefined;
  showRemainingCounts?: boolean | undefined;
  disableCompleted?: boolean | undefined;
  /** What a tap currently does; drives the legend and the key faces. */
  tapAction?: "enter" | "note" | undefined;
  /**
   * The live press, from the game's gesture recognizer. The pad renders
   * it; it does not recognize anything itself.
   */
  gesture: NumPadGesture;
};

/**
 * The digit row. A pure view: every pointer handler it spreads, and the
 * pressed digit it paints, come from the recognizer that owns the whole
 * gesture (see useDigitGesture) — including the parts of it that happen
 * out over the board, which is why the recognizer lives at the game
 * level and the pad only reports its geometry through `groupRef` and
 * the `data-numpad-digit` attributes the hit-tests read.
 */
export function NumPad({
  position,
  remainingCounts,
  selectedValue,
  showRemainingCounts = true,
  disableCompleted = false,
  tapAction,
  gesture,
}: NumPadProps) {
  const isVertical = position === "left" || position === "right";
  const { keyProps, groupRef, pressedDigit } = gesture;

  return (
    <div
      className={`flex flex-col items-center gap-1 lg:gap-2 ${isVertical ? "w-12 lg:w-16" : "w-full lg:w-auto"}`}
    >
      <NumPadLegend isVertical={isVertical} tapAction={tapAction} />
      <div
        ref={groupRef}
        className={`flex gap-1 lg:gap-1.5 ${isVertical ? "flex-col w-12 lg:w-16" : "flex-row justify-center w-full lg:grid lg:grid-cols-3 lg:w-auto lg:gap-2"}`}
        role="group"
        aria-label="Number pad"
      >
        {DIGITS.map((n) => {
          const remaining = remainingCounts[n];
          const isComplete = remaining === 0;
          const isSelected = selectedValue === n;
          // Press state overrides selectedValue so the visual follows
          // the finger across skim transitions.
          const isAccented =
            pressedDigit !== null ? pressedDigit === n : isSelected;

          return (
            <button
              key={n}
              type="button"
              data-numpad-digit={n}
              disabled={(showRemainingCounts || disableCompleted) && isComplete}
              className={`relative flex flex-col items-center justify-center rounded-xl select-none touch-none font-semibold ${isVertical ? "h-11 short:h-10 w-12 lg:h-14 lg:w-16" : "h-14 flex-1 lg:h-16 lg:w-16 lg:flex-none"} ${(showRemainingCounts || disableCompleted) && isComplete ? "invisible" : "press-spring"} ${isAccented ? "bg-accent text-text-on-accent shadow-md shadow-accent/25" : "bg-surface text-text-primary border border-border-default shadow-sm"}`}
              {...keyProps(n)}
              aria-label={numPadKeyLabel({
                digit: n,
                remaining,
                isSelected,
                showRemainingCounts,
                noteMode: tapAction === "note",
              })}
            >
              <NumPadKeyFace
                digit={n}
                remaining={remaining}
                isComplete={isComplete}
                isAccented={isAccented}
                showRemainingCounts={showRemainingCounts}
                noteMode={tapAction === "note"}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
