import { DIGITS } from "../lib/constants.ts";
import type { NumPadLayout, NumPadPosition } from "../lib/types.ts";

type NumPadProps = {
  position: NumPadPosition;
  layout: NumPadLayout;
  remainingCounts: Record<number, number>;
  selectedValue?: number | null | undefined;
  showRemainingCounts?: boolean | undefined;
  disableCompleted?: boolean | undefined;
  onNumber: (n: number) => void;
};

export function NumPad({
  position,
  layout,
  remainingCounts,
  selectedValue,
  showRemainingCounts = true,
  disableCompleted = false,
  onNumber,
}: NumPadProps) {
  const isVertical = position === "left" || position === "right";
  const isGrid = layout === "grid";

  const containerClass = isGrid
    ? "numpad-grid grid grid-cols-3 gap-1.5 w-full max-w-lg"
    : `flex gap-1 lg:flex-col lg:w-14 ${isVertical ? "flex-col" : "flex-row justify-center"} ${isVertical ? "w-12" : "w-full max-w-lg lg:w-14"}`;

  const buttonClass = isGrid
    ? "numpad-grid-btn aspect-square"
    : `lg:h-10 lg:w-14 ${isVertical ? "h-11 w-12" : "h-14 flex-1 max-w-14"}`;

  return (
    <div className={containerClass} role="group" aria-label="Number pad">
      {DIGITS.map((n) => {
        const remaining = remainingCounts[n];
        const isComplete = remaining === 0;
        const isSelected = selectedValue === n;

        return (
          <button
            key={n}
            type="button"
            disabled={(showRemainingCounts || disableCompleted) && isComplete}
            className={`flex flex-col items-center justify-center rounded-lg select-none touch-manipulation font-semibold ${buttonClass} ${(showRemainingCounts || disableCompleted) && isComplete ? "opacity-30 cursor-default" : "press-spring"} ${isSelected ? "bg-accent text-text-on-accent shadow-md" : "bg-bg-raised text-text-primary active:bg-accent active:text-text-on-accent active:shadow-md"}`}
            onClick={() => onNumber(n)}
            aria-label={
              showRemainingCounts
                ? `${n}, ${remaining} remaining${isSelected ? ", selected" : ""}`
                : `${n}${isSelected ? ", selected" : ""}`
            }
          >
            <span
              className={
                isGrid ? "text-2xl leading-none" : "text-lg leading-none"
              }
            >
              {n}
            </span>
          </button>
        );
      })}
    </div>
  );
}
