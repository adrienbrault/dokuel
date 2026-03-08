import { DIGITS } from "../lib/constants.ts";
import type { NumPadPosition } from "../lib/types.ts";

type NumPadProps = {
  position: NumPadPosition;
  remainingCounts: Record<number, number>;
  selectedValue?: number | null | undefined;
  onNumber: (n: number) => void;
};

export function NumPad({
  position,
  remainingCounts,
  selectedValue,
  onNumber,
}: NumPadProps) {
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
        const isSelected = selectedValue === n;

        return (
          <button
            key={n}
            type="button"
            disabled={isComplete}
            className={`flex flex-col items-center justify-center rounded-lg select-none touch-manipulation font-semibold lg:h-10 lg:w-14 ${isVertical ? "h-11 w-12" : "h-14 flex-1 max-w-14"} ${isComplete ? "opacity-30 cursor-default" : "press-spring"} ${isSelected ? "bg-accent text-text-on-accent shadow-md" : "bg-bg-raised text-text-primary active:bg-accent active:text-text-on-accent active:shadow-md"}`}
            onClick={() => onNumber(n)}
            aria-label={`${n}, ${remaining} remaining${isSelected ? ", selected" : ""}`}
          >
            <span className="text-lg leading-none">{n}</span>
            <span
              className={`text-[0.5625rem] leading-none mt-0.5 ${isComplete ? "invisible" : isSelected ? "text-text-on-accent/70" : "text-text-muted"}`}
            >
              {remaining}
            </span>
          </button>
        );
      })}
    </div>
  );
}
