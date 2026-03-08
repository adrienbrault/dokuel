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
    color: "bg-green-400",
  },
  {
    value: "medium",
    label: "Medium",
    description: "A fair challenge",
    color: "bg-yellow-400",
  },
  {
    value: "hard",
    label: "Hard",
    description: "For experienced players",
    color: "bg-orange-400",
  },
  {
    value: "expert",
    label: "Expert",
    description: "The ultimate test",
    color: "bg-red-400",
  },
];

export function DifficultyPicker({ onSelect, onBack }: DifficultyPickerProps) {
  const [showConflicts, setShowConflicts] = useState(true);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm px-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Choose Difficulty
      </h2>
      <div className="flex flex-col gap-3 w-full">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.value}
            type="button"
            className="
							flex flex-col items-start gap-0.5
							w-full px-5 py-4 rounded-xl
							bg-gray-50 dark:bg-gray-900
							border border-gray-200 dark:border-gray-800
							press-spring-soft
							select-none touch-manipulation
						"
            onClick={() => onSelect(d.value, showConflicts)}
          >
            <span className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              <span
                className={`w-2.5 h-2.5 rounded-full ${d.color}`}
                aria-hidden="true"
              />
              {d.label}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {d.description}
            </span>
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
        className="text-sm text-gray-400 dark:text-gray-500 mt-2 touch-manipulation"
        onClick={onBack}
      >
        ← Back
      </button>
    </div>
  );
}
