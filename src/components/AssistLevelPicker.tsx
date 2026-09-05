import type { AssistLevel } from "../lib/types.ts";
import { SlidingRadioGroup } from "./SlidingRadioGroup.tsx";

const OPTIONS: { value: AssistLevel; label: string; description: string }[] = [
  { value: "paper", label: "Paper", description: "No automatic help" },
  { value: "standard", label: "Standard", description: "Errors + notes" },
  { value: "full", label: "Full", description: "Counts + highlights" },
];

type AssistLevelPickerProps = {
  value: AssistLevel;
  onChange: (level: AssistLevel) => void;
};

export function AssistLevelPicker({ value, onChange }: AssistLevelPickerProps) {
  return (
    <div>
      <SlidingRadioGroup
        options={OPTIONS}
        value={value}
        onChange={onChange}
        name="assist-level"
        ariaLabel="Assistance level"
      />
      <p className="caption mt-2 leading-relaxed">
        {value === "paper"
          ? "Play without error highlights, counts, or automatic note clearing. Hints remain optional in solo and exclude a personal best."
          : value === "standard"
            ? "Highlight incorrect entries and clear notes when their digit is placed in a peer cell."
            : "Standard help plus remaining-digit counts and highlights showing where a digit cannot go."}
      </p>
    </div>
  );
}
