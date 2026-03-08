import { DIGITS } from "../lib/constants.ts";
import type { NumPadPosition } from "../lib/types.ts";

type NumPadProps = {
  position: NumPadPosition;
  remainingCounts: Record<number, number>;
  onNumber: (n: number) => void;
};

export function NumPad({ position, remainingCounts, onNumber }: NumPadProps) {
  const isVertical = position === "left" || position === "right";

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

        return (
          <button
            key={n}
            type="button"
            disabled={isComplete}
            className={`flex flex-col items-center justify-center rounded-lg select-none touch-manipulation text-lg font-semibold bg-bg-raised text-text-primary active:bg-accent active:text-text-on-accent active:shadow-md lg:h-10 lg:w-14 ${isVertical ? "h-9 w-12" : "h-12 flex-1 max-w-14"} ${isComplete ? "opacity-30 cursor-default" : "press-spring"}`}
            onClick={() => onNumber(n)}
            aria-label={`${n}, ${remaining} remaining`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
