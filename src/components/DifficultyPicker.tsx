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
  rank: number;
  tile: string;
  bar: string;
  barDim: string;
}[] = [
  {
    value: "easy",
    label: "Easy",
    description: "Great for warming up",
    rank: 1,
    tile: "bg-difficulty-easy-bg",
    bar: "bg-difficulty-easy",
    barDim: "bg-difficulty-easy/25",
  },
  {
    value: "medium",
    label: "Medium",
    description: "A balanced challenge",
    rank: 2,
    tile: "bg-difficulty-medium-bg",
    bar: "bg-difficulty-medium",
    barDim: "bg-difficulty-medium/25",
  },
  {
    value: "hard",
    label: "Hard",
    description: "For experienced players",
    rank: 3,
    tile: "bg-difficulty-hard-bg",
    bar: "bg-difficulty-hard",
    barDim: "bg-difficulty-hard/25",
  },
  {
    value: "expert",
    label: "Expert",
    description: "The ultimate test",
    rank: 4,
    tile: "bg-difficulty-expert-bg",
    bar: "bg-difficulty-expert",
    barDim: "bg-difficulty-expert/25",
  },
];

function DifficultyMeter({
  rank,
  bar,
  barDim,
}: {
  rank: number;
  bar: string;
  barDim: string;
}) {
  return (
    <span className="flex items-end gap-[3px] h-5" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`w-[3.5px] rounded-full ${i <= rank ? bar : barDim}`}
          style={{ height: `${5 + i * 3.5}px` }}
        />
      ))}
    </span>
  );
}

export function DifficultyPicker({ onSelect, onBack }: DifficultyPickerProps) {
  const { level: assistLevel, setLevel: setAssistLevel } = useAssistLevel();

  return (
    <div className="screen-content gap-6 py-8">
      <div className="flex flex-col items-center gap-1">
        <h2 className="heading">Choose Difficulty</h2>
        <p className="caption">Pick a level to start your puzzle</p>
      </div>

      <div className="flex flex-col gap-2.5 w-full">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.value}
            type="button"
            className="card flex items-center gap-3.5 w-full px-4 py-3.5 press-spring-soft select-none touch-manipulation focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            onClick={() => onSelect(d.value, assistLevel)}
          >
            <span className={`icon-tile w-12 h-12 ${d.tile}`}>
              <DifficultyMeter rank={d.rank} bar={d.bar} barDim={d.barDim} />
            </span>
            <span className="flex-1 min-w-0 text-left">
              <span className="text-base font-semibold text-text-primary block">
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
        <span className="label">Assistance</span>
        <AssistLevelPicker value={assistLevel} onChange={setAssistLevel} />
      </div>

      <button
        type="button"
        className="btn btn-ghost touch-manipulation"
        onClick={onBack}
      >
        ← Back
      </button>
    </div>
  );
}
