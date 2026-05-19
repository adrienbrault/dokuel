import { useAssistLevel } from "../hooks/useAssistLevel.ts";
import { DIFFICULTY_BADGE_CLASSES } from "../lib/constants.ts";
import type { AssistLevel, Difficulty } from "../lib/types.ts";
import { AssistLevelPicker } from "./AssistLevelPicker.tsx";

type DifficultyPickerProps = {
  onSelect: (difficulty: Difficulty, assistLevel: AssistLevel) => void;
  onBack: () => void;
};

const DIFFICULTIES: {
  value: Difficulty;
  label: string;
  description: string;
  level: number;
}[] = [
  {
    value: "easy",
    label: "Easy",
    description: "Great for warming up",
    level: 1,
  },
  {
    value: "medium",
    label: "Medium",
    description: "A fair challenge",
    level: 2,
  },
  {
    value: "hard",
    label: "Hard",
    description: "For experienced players",
    level: 3,
  },
  {
    value: "expert",
    label: "Expert",
    description: "The ultimate test",
    level: 4,
  },
];

export function DifficultyPicker({ onSelect, onBack }: DifficultyPickerProps) {
  const { level: assistLevel, setLevel: setAssistLevel } = useAssistLevel();

  return (
    <div className="screen-content gap-6 py-10">
      <h2 className="heading">Choose Difficulty</h2>
      <div className="flex flex-col gap-3 w-full">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.value}
            type="button"
            className="card card-interactive flex items-center gap-3.5 w-full px-4 py-3.5 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            onClick={() => onSelect(d.value, assistLevel)}
          >
            <span
              className={`flex items-center justify-center w-11 h-11 rounded-xl ${DIFFICULTY_BADGE_CLASSES[d.value]}`}
            >
              <DifficultyBars level={d.level} />
            </span>
            <span className="flex flex-1 flex-col items-start text-left leading-tight">
              <span className="text-base font-bold text-text-primary">
                {d.label}
              </span>
              <span className="text-xs text-text-muted">{d.description}</span>
            </span>
            <ChevronRightIcon />
          </button>
        ))}
      </div>
      <AssistLevelPicker value={assistLevel} onChange={setAssistLevel} />
      <button
        type="button"
        className="btn btn-ghost mt-1 touch-manipulation"
        onClick={onBack}
      >
        ← Back
      </button>
    </div>
  );
}

function DifficultyBars({ level }: { level: number }) {
  const heights = [7, 11, 15, 19];
  return (
    <span className="flex items-end gap-[3px] h-5" aria-hidden="true">
      {heights.map((h, i) => (
        <span
          key={i}
          className="w-[3.5px] rounded-full bg-current"
          style={{ height: h, opacity: i < level ? 1 : 0.25 }}
        />
      ))}
    </span>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-text-muted shrink-0"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
