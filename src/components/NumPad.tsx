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
				flex gap-1
				${isVertical ? "flex-col" : "flex-row"}
				${isVertical ? "w-12" : "w-full max-w-lg"}
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
            className={`
							flex flex-col items-center justify-center
							${isVertical ? "h-9 w-12" : "h-12 flex-1"}
							rounded-lg
							select-none touch-manipulation
							text-lg font-semibold
							${isComplete ? "opacity-30 cursor-default" : "press-spring"}
							bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200
							active:bg-accent active:text-white active:shadow-md
						`}
            onClick={() => onNumber(n)}
            aria-label={`${n}, ${remaining} remaining`}
          >
            <span className="leading-none">{n}</span>
            {remaining > 0 && (
              <span className="text-[0.5rem] opacity-60 leading-none mt-0.5">
                {remaining}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
