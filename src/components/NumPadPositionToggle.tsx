import type { NumPadPosition } from "../lib/types.ts";

type NumPadPositionToggleProps = {
  position: NumPadPosition;
  onChange: (position: NumPadPosition) => void;
};

const OPTIONS: { value: NumPadPosition; label: string; glyph: string }[] = [
  { value: "left", label: "Left", glyph: "←" },
  { value: "bottom", label: "Bottom", glyph: "↓" },
  { value: "right", label: "Right", glyph: "→" },
];

export function NumPadPositionToggle({
  position,
  onChange,
}: NumPadPositionToggleProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="label">Numpad position</span>
      <div
        className="flex gap-1 bg-bg-inset rounded-xl p-1"
        role="radiogroup"
        aria-label="Number pad position"
      >
        {OPTIONS.map((opt) => {
          const active = position === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={`flex flex-1 items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-semibold transition-all duration-150 select-none touch-manipulation ${
                active
                  ? "bg-accent text-text-on-accent shadow-sm"
                  : "text-text-muted hover:text-text-primary"
              }`}
              onClick={() => onChange(opt.value)}
              aria-label={`Pad ${opt.value}`}
            >
              <span aria-hidden="true">{opt.glyph}</span>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
