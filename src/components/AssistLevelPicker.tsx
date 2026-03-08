import type { AssistLevel } from "../lib/types.ts";

const OPTIONS: { value: AssistLevel; label: string; description: string }[] = [
  { value: "paper", label: "Paper", description: "No hints" },
  { value: "standard", label: "Standard", description: "Highlights" },
  { value: "full", label: "Full", description: "Auto-notes" },
];

type AssistLevelPickerProps = {
  value: AssistLevel;
  onChange: (level: AssistLevel) => void;
};

export function AssistLevelPicker({ value, onChange }: AssistLevelPickerProps) {
  const activeIndex = OPTIONS.findIndex((o) => o.value === value);

  return (
    <div
      role="radiogroup"
      aria-label="Assistance level"
      className="relative flex w-full rounded-xl bg-bg-inset p-1"
    >
      {/* Sliding indicator */}
      <div
        className="absolute top-1 bottom-1 rounded-lg bg-accent shadow-sm transition-transform duration-200 ease-out"
        style={{
          width: `calc((100% - 0.5rem) / 3)`,
          transform: `translateX(calc(${activeIndex} * 100%))`,
        }}
        aria-hidden="true"
      />

      {OPTIONS.map((option) => {
        const isActive = option.value === value;
        return (
          <label
            key={option.value}
            className={`relative z-10 flex flex-1 flex-col items-center gap-0.5 rounded-lg py-2 cursor-pointer select-none touch-manipulation transition-colors duration-200 ${
              isActive ? "text-text-on-accent" : "text-text-secondary"
            }`}
          >
            <input
              type="radio"
              name="assist-level"
              value={option.value}
              checked={isActive}
              onChange={() => {
                if (!isActive) onChange(option.value);
              }}
              className="sr-only"
            />
            <span className="text-sm font-semibold leading-none">
              {option.label}
            </span>
            <span
              className={`text-[0.625rem] leading-none transition-colors duration-200 ${
                isActive ? "text-text-on-accent/70" : "text-text-muted"
              }`}
            >
              {option.description}
            </span>
          </label>
        );
      })}
    </div>
  );
}
