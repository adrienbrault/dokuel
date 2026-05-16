import { DIGITS } from "../lib/constants.ts";
import type { NumPadPosition } from "../lib/types.ts";

type NumPadProps = {
  position: NumPadPosition;
  remainingCounts: Record<number, number>;
  selectedValue?: number | null | undefined;
  showRemainingCounts?: boolean | undefined;
  disableCompleted?: boolean | undefined;
  onNumber: (n: number) => void;
};

const NUMPAD_SIZE = {
  vertical: {
    container: "flex-col w-12 lg:w-16",
    button: "h-11 w-12 lg:h-14 lg:w-16",
  },
  horizontal: {
    container: "flex-row justify-center w-full max-w-lg lg:max-w-xl",
    button: "h-14 flex-1 max-w-14 lg:max-w-16 lg:h-16",
  },
} as const;

export function NumPad({
  position,
  remainingCounts,
  selectedValue,
  showRemainingCounts = true,
  disableCompleted = false,
  onNumber,
}: NumPadProps) {
  const orientation =
    position === "left" || position === "right" ? "vertical" : "horizontal";
  const size = NUMPAD_SIZE[orientation];

  return (
    <div
      className={`flex gap-1 ${size.container}`}
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
            className={`flex flex-col items-center justify-center rounded-lg select-none touch-manipulation font-semibold ${size.button} ${(showRemainingCounts || disableCompleted) && isComplete ? "invisible" : "press-spring"} ${isSelected ? "bg-accent text-text-on-accent shadow-md" : "bg-bg-raised text-text-primary active:bg-accent active:text-text-on-accent active:shadow-md"}`}
            onClick={() => onNumber(n)}
            aria-label={
              showRemainingCounts
                ? `${n}, ${remaining} remaining${isSelected ? ", selected" : ""}`
                : `${n}${isSelected ? ", selected" : ""}`
            }
          >
            <span className="text-lg lg:text-xl leading-none">{n}</span>
            {showRemainingCounts && (
              <span
                className={`text-[0.625rem] lg:text-xs leading-none mt-0.5 ${isComplete ? "invisible" : isSelected ? "text-text-on-accent/70" : "text-text-secondary"}`}
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
