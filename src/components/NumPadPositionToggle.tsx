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
    <div className="flex items-center" title="Number pad position">
      <div
        className="flex gap-1 bg-bg-inset rounded-xl p-1"
        role="radiogroup"
        aria-label="Number pad position"
      >
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={position === opt.value}
            className={`w-9 h-8 rounded-lg flex items-center justify-center text-sm transition-all duration-150 select-none ${
              position === opt.value
                ? "bg-surface text-accent font-bold"
                : "text-text-muted hover:text-text-secondary"
            }`}
            style={
              position === opt.value
                ? { boxShadow: "var(--elevation-1)" }
                : undefined
            }
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
