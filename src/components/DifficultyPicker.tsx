import { useState } from "react";
import type { Difficulty } from "../lib/types.ts";
import { ToggleSwitch } from "./ToggleSwitch.tsx";

type DifficultyPickerProps = {
  onSelect: (difficulty: Difficulty, showConflicts: boolean) => void;
  onBack: () => void;
};

const DIFFICULTIES: {
  value: Difficulty;
  label: string;
  description: string;
  color: string;
}[] = [
  {
    value: "easy",
    label: "Easy",
    description: "Great for warming up",
    color: "bg-difficulty-easy",
  },
  {
    value: "medium",
    label: "Medium",
    description: "A fair challenge",
    color: "bg-difficulty-medium",
  },
  {
    value: "hard",
    label: "Hard",
    description: "For experienced players",
    color: "bg-difficulty-hard",
  },
  {
    value: "expert",
    label: "Expert",
    description: "The ultimate test",
    color: "bg-difficulty-expert",
  },
];

export function DifficultyPicker({ onSelect, onBack }: DifficultyPickerProps) {
  const [showConflicts, setShowConflicts] = useState(true);

  return (
    <div className="screen-content gap-6">
      <h2 className="heading">Choose Difficulty</h2>
      <div className="flex flex-col gap-3 w-full">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.value}
            type="button"
            className="card flex flex-col items-start gap-0.5 w-full px-5 py-4 press-spring-soft select-none touch-manipulation"
            onClick={() => onSelect(d.value, showConflicts)}
          >
            <span className="flex items-center gap-2 text-lg font-semibold text-text-primary">
              <span
                className={`w-2.5 h-2.5 rounded-full ${d.color}`}
                aria-hidden="true"
              />
              {d.label}
            </span>
            <span className="caption">{d.description}</span>
          </button>
        ))}
      </div>
      <ToggleSwitch
        checked={showConflicts}
        onChange={() => setShowConflicts(!showConflicts)}
        label="Show placement errors"
      />
      <button
        type="button"
        className="btn-ghost mt-2 touch-manipulation"
        onClick={onBack}
      >
        ← Back
      </button>
    </div>
  );
}
