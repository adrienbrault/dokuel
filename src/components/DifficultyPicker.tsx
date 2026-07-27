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
  clues: string;
  level: number;
  chip: string;
  text: string;
  bar: string;
}[] = [
  {
    value: "easy",
    label: "Easy",
    description: "Great for warming up",
    clues: "~45 clues",
    level: 1,
    chip: "bg-difficulty-easy-bg",
    text: "text-difficulty-easy-text",
    bar: "bg-difficulty-easy",
  },
  {
    value: "medium",
    label: "Medium",
    description: "A fair challenge",
    clues: "~35 clues",
    level: 2,
    chip: "bg-difficulty-medium-bg",
    text: "text-difficulty-medium-text",
    bar: "bg-difficulty-medium",
  },
  {
    value: "hard",
    label: "Hard",
    description: "For experienced players",
    clues: "~28 clues",
    level: 3,
    chip: "bg-difficulty-hard-bg",
    text: "text-difficulty-hard-text",
    bar: "bg-difficulty-hard",
  },
  {
    value: "expert",
    label: "Expert",
    description: "The ultimate test",
    clues: "~22 clues",
    level: 4,
    chip: "bg-difficulty-expert-bg",
    text: "text-difficulty-expert-text",
    bar: "bg-difficulty-expert",
  },
];

const BAR_HEIGHTS = ["h-1.5", "h-2.5", "h-3.5", "h-4.5"];

function LevelBars({ level, color }: { level: number; color: string }) {
  return (
    <span className="flex items-end gap-[3px] h-5" aria-hidden="true">
      {BAR_HEIGHTS.map((h, i) => (
        <span
          key={h}
          className={`w-[5px] rounded-sm ${h} ${
            i < level ? color : "bg-current opacity-20"
          }`}
        />
      ))}
    </span>
  );
}

export function DifficultyPicker({ onSelect, onBack }: DifficultyPickerProps) {
  const { level: assistLevel, setLevel: setAssistLevel } = useAssistLevel();

  return (
    <div className="screen-content gap-6 py-10">
      <header className="flex flex-col items-center gap-1">
        <h2 className="heading">Choose Difficulty</h2>
        <p className="caption">Pick how hard the puzzle should be.</p>
      </header>

      <div className="flex flex-col gap-2.5 w-full">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.value}
            type="button"
            className="card w-full flex items-center gap-3.5 px-4 py-3.5 press-spring-soft select-none touch-manipulation"
            onClick={() => onSelect(d.value, assistLevel)}
          >
            <span
              className={`icon-chip w-12 h-12 ${d.chip} ${d.text}`}
              aria-hidden="true"
            >
              <LevelBars level={d.level} color={d.bar} />
            </span>
            <span className="flex-1 text-left min-w-0">
              <span className="flex items-baseline gap-2">
                <span className={`text-lg font-bold ${d.text}`}>{d.label}</span>
                {/* The clue count is the concrete fact behind the label —
                    "Hard" means nothing on its own, 28 given cells does. */}
                <span className="text-[0.6875rem] font-medium text-text-muted tabular-nums">
                  {d.clues}
                </span>
              </span>
              <span className="block caption truncate">{d.description}</span>
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
        className="btn-ghost mt-1 touch-manipulation"
        onClick={onBack}
      >
        ← Back
      </button>
    </div>
  );
}
