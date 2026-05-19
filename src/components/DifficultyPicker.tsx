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
  chip: string;
  bar: string;
}[] = [
  {
    value: "easy",
    label: "Easy",
    description: "Great for warming up",
    level: 1,
    chip: "bg-difficulty-easy-bg",
    bar: "bg-difficulty-easy",
  },
  {
    value: "medium",
    label: "Medium",
    description: "A fair challenge",
    level: 2,
    chip: "bg-difficulty-medium-bg",
    bar: "bg-difficulty-medium",
  },
  {
    value: "hard",
    label: "Hard",
    description: "For experienced players",
    level: 3,
    chip: "bg-difficulty-hard-bg",
    bar: "bg-difficulty-hard",
  },
  {
    value: "expert",
    label: "Expert",
    description: "The ultimate test",
    level: 4,
    chip: "bg-difficulty-expert-bg",
    bar: "bg-difficulty-expert",
  },
];

export function DifficultyPicker({ onSelect, onBack }: DifficultyPickerProps) {
  const { level: assistLevel, setLevel: setAssistLevel } = useAssistLevel();

  return (
    <div className="screen-content gap-7">
      <div className="flex flex-col items-center gap-1">
        <h2 className="heading">Choose Difficulty</h2>
        <p className="caption">Pick your challenge, then assistance level</p>
      </div>

      <div className="flex flex-col gap-2.5 w-full">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.value}
            type="button"
            className="card flex items-center gap-3.5 w-full px-3.5 py-3 press-spring-soft text-left focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            onClick={() => onSelect(d.value, assistLevel)}
          >
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${d.chip}`}
              aria-hidden="true"
            >
              <DifficultyBars level={d.level} bar={d.bar} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-base font-semibold leading-tight text-text-primary">
                {d.label}
              </span>
              <span className="block text-[13px] text-text-muted">
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
        className="btn-ghost touch-manipulation"
        onClick={onBack}
      >
        ← Back
      </button>
    </div>
  );
}

function DifficultyBars({ level, bar }: { level: number; bar: string }) {
  return (
    <span className="flex items-end gap-[3px]" aria-hidden="true">
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className={`w-1 rounded-full ${bar} ${n <= level ? "" : "opacity-25"}`}
          style={{ height: `${5 + n * 3}px` }}
        />
      ))}
    </span>
  );
}
