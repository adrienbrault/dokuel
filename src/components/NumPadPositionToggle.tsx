import type { NumPadPosition } from "../lib/types.ts";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group.tsx";

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
      <ToggleGroup
        type="single"
        value={position}
        onValueChange={(next) => {
          if (next && next !== position) onChange(next as NumPadPosition);
        }}
        role="radiogroup"
        aria-label="Number pad position"
        className="bg-bg-raised rounded-lg p-1 gap-1"
      >
        {OPTIONS.map((opt) => (
          <ToggleGroupItem
            key={opt.value}
            value={opt.value}
            aria-label={`Pad ${opt.value}`}
            className="w-8 h-8 rounded-md data-[state=on]:bg-bg-overlay data-[state=on]:shadow-sm data-[state=on]:text-accent data-[state=on]:font-bold"
          >
            {opt.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
