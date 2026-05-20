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
  level: number;
  bar: string;
  chip: string;
}[] = [
  {
    value: "easy",
    label: "Easy",
    description: "Great for warming up",
    level: 1,
    bar: "bg-difficulty-easy",
    chip: "bg-difficulty-easy-bg",
  },
  {
    value: "medium",
    label: "Medium",
    description: "A fair challenge",
    level: 2,
    bar: "bg-difficulty-medium",
    chip: "bg-difficulty-medium-bg",
  },
  {
    value: "hard",
    label: "Hard",
    description: "For experienced players",
    level: 3,
    bar: "bg-difficulty-hard",
    chip: "bg-difficulty-hard-bg",
  },
  {
    value: "expert",
    label: "Expert",
    description: "The ultimate test",
    level: 4,
    bar: "bg-difficulty-expert",
    chip: "bg-difficulty-expert-bg",
  },
];

export function DifficultyPicker({ onSelect, onBack }: DifficultyPickerProps) {
  const { level: assistLevel, setLevel: setAssistLevel } = useAssistLevel();

  return (
    <div className="screen-content gap-6">
      <h2 className="heading">Choose Difficulty</h2>
      <div className="flex flex-col gap-3 w-full">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.value}
            type="button"
            className="card flex items-center gap-4 w-full px-4 py-3.5 press-spring-soft select-none touch-manipulation hover:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none transition-colors"
            onClick={() => onSelect(d.value, assistLevel)}
          >
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${d.chip}`}
            >
              <DifficultyBars level={d.level} colorClass={d.bar} />
            </span>
            <span className="flex flex-col items-start gap-0.5 flex-1 min-w-0">
              <span className="text-lg font-semibold text-text-primary">
                {d.label}
              </span>
              <span className="caption">{d.description}</span>
            </span>
            <ChevronRight
              size={20}
              className="text-text-muted shrink-0"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      <AssistLevelPicker value={assistLevel} onChange={setAssistLevel} />
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

function DifficultyBars({
  level,
  colorClass,
}: {
  level: number;
  colorClass: string;
}) {
  const heights = ["h-2", "h-3", "h-4", "h-5"];
  return (
    <span className="flex items-end gap-[3px]" aria-hidden="true">
      {heights.map((h, i) => (
        <span
          key={h}
          className={`w-1.5 rounded-full ${h} ${
            i < level ? colorClass : "bg-bg-inset"
          }`}
        />
      ))}
    </span>
  );
}
