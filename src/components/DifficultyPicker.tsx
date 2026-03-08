import type { Difficulty } from "../lib/types.ts";

type DifficultyPickerProps = {
  onSelect: (difficulty: Difficulty) => void;
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
            onClick={() => onSelect(d.value)}
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
      <button
        type="button"
        className="text-sm text-gray-400 dark:text-gray-500 mt-2 touch-manipulation"
        onClick={onBack}
      >
        Back
      </button>
    </div>
  );
}
