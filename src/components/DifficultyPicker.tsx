import { useState } from "react";
import type { Difficulty } from "../lib/types.ts";

type DifficultyPickerProps = {
  onSelect: (difficulty: Difficulty, showConflicts: boolean) => void;
  onBack: () => void;
};

const DIFFICULTIES: {
  value: Difficulty;
  label: string;
  description: string;
}[] = [
  { value: "easy", label: "Easy", description: "Great for warming up" },
  { value: "medium", label: "Medium", description: "A fair challenge" },
  { value: "hard", label: "Hard", description: "For experienced players" },
  { value: "expert", label: "Expert", description: "The ultimate test" },
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
            <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {d.label}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {d.description}
            </span>
          </button>
        ))}
      </div>
      <label className="flex items-center gap-3 cursor-pointer select-none touch-manipulation">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Show placement errors
        </span>
        <input
          type="checkbox"
          checked={showConflicts}
          onChange={() => setShowConflicts(!showConflicts)}
          aria-label="Show placement errors"
          className="w-5 h-5 rounded accent-accent"
        />
      </label>
      <button
        type="button"
        className="w-full py-3 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 touch-manipulation press-spring-soft"
        onClick={onBack}
      >
        ← Back
      </button>
    </div>
  );
}
