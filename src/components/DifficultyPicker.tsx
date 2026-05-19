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
  dot: string;
  chip: string;
}[] = [
  {
    value: "easy",
    label: "Easy",
    description: "Great for warming up",
    dot: "bg-difficulty-easy",
    chip: "bg-difficulty-easy-bg",
  },
  {
    value: "medium",
    label: "Medium",
    description: "A fair challenge",
    dot: "bg-difficulty-medium",
    chip: "bg-difficulty-medium-bg",
  },
  {
    value: "hard",
    label: "Hard",
    description: "For experienced players",
    dot: "bg-difficulty-hard",
    chip: "bg-difficulty-hard-bg",
  },
  {
    value: "expert",
    label: "Expert",
    description: "The ultimate test",
    dot: "bg-difficulty-expert",
    chip: "bg-difficulty-expert-bg",
  },
];

export function DifficultyPicker({ onSelect, onBack }: DifficultyPickerProps) {
  const { level: assistLevel, setLevel: setAssistLevel } = useAssistLevel();

  return (
    <div className="screen-content gap-6">
      <h2 className="heading">Choose Difficulty</h2>
      <div className="flex w-full flex-col gap-2.5">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.value}
            type="button"
            className="card press-spring-soft flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors touch-manipulation select-none hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => onSelect(d.value, assistLevel)}
          >
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${d.chip}`}
              aria-hidden="true"
            >
              <span className={`h-3.5 w-3.5 rounded-full ${d.dot}`} />
            </span>
            <span className="flex flex-1 flex-col">
              <span className="text-base font-semibold text-text-primary">
                {d.label}
              </span>
              <span className="caption">{d.description}</span>
            </span>
            <ChevronRight
              size={18}
              className="shrink-0 text-text-muted"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      <AssistLevelPicker value={assistLevel} onChange={setAssistLevel} />
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
