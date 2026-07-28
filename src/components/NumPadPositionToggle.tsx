import type { NumPadPosition } from "../lib/types.ts";

type NumPadPositionToggleProps = {
  position: NumPadPosition;
  onChange: (position: NumPadPosition) => void;
};

const OPTIONS: { value: NumPadPosition; label: string }[] = [
  { value: "left", label: "←" },
  { value: "bottom", label: "↓" },
  { value: "right", label: "→" },
];

export function NumPadPositionToggle({
  position,
  onChange,
}: NumPadPositionToggleProps) {
  return (
    <div className="flex items-center gap-1.5" title="Number pad position">
      <span className="text-[10px] font-medium text-text-muted uppercase tracking-wide">
        Pad
      </span>
      <div
        className="flex gap-1 bg-bg-inset border border-border-default rounded-[10px] p-1"
        role="radiogroup"
        aria-label="Number pad position"
      >
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={position === opt.value}
            className={`w-8 h-8 rounded-[7px] flex items-center justify-center text-sm transition-all duration-150 select-none ${
              position === opt.value
                ? "bg-surface border border-border-default shadow-[0_1px_2px_oklch(0.25_0.02_264/0.05)] text-accent font-bold"
                : "text-text-muted"
            }`}
            onClick={() => onChange(opt.value)}
            aria-label={`Pad ${opt.value}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
