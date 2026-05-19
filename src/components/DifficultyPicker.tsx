import { ChevronRight } from "lucide-react";
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
    <div className="screen-content gap-6">
      <div className="flex flex-col items-center gap-1">
        <h2 className="heading">Choose Difficulty</h2>
        <p className="caption">How tough should the puzzle be?</p>
      </div>
      <div className="flex flex-col gap-2.5 w-full">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.value}
            type="button"
            className="card flex items-center gap-3.5 w-full px-4 py-3.5 press-spring-soft select-none touch-manipulation hover:bg-bg-raised focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none transition-colors"
            onClick={() => onSelect(d.value, assistLevel)}
          >
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${DIFFICULTY_BADGE_CLASSES[d.value]}`}
            >
              <DifficultyBars level={d.level} />
            </span>
            <span className="flex flex-col items-start min-w-0 flex-1">
              <span className="text-base font-bold text-text-primary">
                {d.label}
              </span>
              <span className="text-xs text-text-muted">{d.description}</span>
            </span>
            <ChevronRight
              size={18}
              className="text-text-muted shrink-0"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 w-full">
        <span className="label px-1">Assistance</span>
        <AssistLevelPicker value={assistLevel} onChange={setAssistLevel} />
      </div>
      <button
        type="button"
        className="btn-ghost mt-1 touch-manipulation"
        onClick={onBack}
      >
        ← Back
      </button>
    </div>
  );
}

function DifficultyBars({ level }: { level: number }) {
  return (
    <span className="flex items-end gap-[3px] h-4" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`w-1 rounded-[2px] ${i <= level ? "bg-current" : "bg-current opacity-25"}`}
          style={{ height: `${i * 22 + 12}%` }}
        />
      ))}
    </span>
  );
}
