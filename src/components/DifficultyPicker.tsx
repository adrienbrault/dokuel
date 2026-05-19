import { ChevronRight } from "lucide-react";
import { useAssistLevel } from "../hooks/useAssistLevel.ts";
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

const BAR_HEIGHTS = ["h-1.5", "h-2.5", "h-3.5", "h-4.5"];

function LevelBars({ level, color }: { level: number; color: string }) {
  return (
    <span className="flex items-end gap-1" aria-hidden="true">
      {BAR_HEIGHTS.map((h, i) => (
        <span
          key={h}
          className={`w-1.5 rounded-full ${h} ${
            i < level ? color : "bg-border-default"
          }`}
        />
      ))}
    </span>
  );
}

export function DifficultyPicker({ onSelect, onBack }: DifficultyPickerProps) {
  const { level: assistLevel, setLevel: setAssistLevel } = useAssistLevel();

  return (
    <div className="screen-content gap-6">
      <h2 className="heading">Choose Difficulty</h2>
      <div className="flex flex-col gap-3 w-full">
        {DIFFICULTIES.map((d, i) => (
          <button
            key={d.value}
            type="button"
            className="card flex items-center gap-4 w-full px-4 py-4 press-spring-soft select-none touch-manipulation hover:bg-bg-raised focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none transition-colors"
            onClick={() => onSelect(d.value, assistLevel)}
          >
            <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-bg-inset">
              <LevelBars level={i + 1} color={d.color} />
            </span>
            <span className="flex-1 text-left">
              <span className="block text-lg font-bold text-text-primary">
                {d.label}
              </span>
              <span className="block text-sm text-text-muted">
                {d.description}
              </span>
            </span>
            <ChevronRight
              size={20}
              className="text-text-muted shrink-0"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 w-full">
        <span className="label">Assistance</span>
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
