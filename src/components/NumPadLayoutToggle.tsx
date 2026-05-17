import type { NumPadLayout } from "../lib/types.ts";

type NumPadLayoutToggleProps = {
  layout: NumPadLayout;
  onChange: (layout: NumPadLayout) => void;
};

const OPTIONS: { value: NumPadLayout; label: string; ariaLabel: string }[] = [
  { value: "linear", label: "···", ariaLabel: "Layout linear" },
  { value: "grid", label: "▦", ariaLabel: "Layout grid" },
];

export function NumPadLayoutToggle({
  layout,
  onChange,
}: NumPadLayoutToggleProps) {
  return (
    <div className="flex items-center gap-1.5" title="Number pad layout">
      <span className="text-[10px] font-medium text-text-muted uppercase tracking-wide">
        Shape
      </span>
      <div
        className="flex gap-1 bg-bg-raised rounded-lg p-1"
        role="radiogroup"
        aria-label="Number pad layout"
      >
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={layout === opt.value}
            className={`w-8 h-8 rounded-md flex items-center justify-center text-sm transition-all duration-150 select-none ${
              layout === opt.value
                ? "bg-bg-overlay shadow-sm text-accent font-bold"
                : "text-text-muted"
            }`}
            onClick={() => onChange(opt.value)}
            aria-label={opt.ariaLabel}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
