import { ChevronRight } from "lucide-react";
import { useAssistLevel } from "../hooks/useAssistLevel.ts";
import type { AssistLevel, Difficulty } from "../lib/types.ts";
import { AssistLevelPicker } from "./AssistLevelPicker.tsx";
import { SpriteIcon, type SpriteName } from "./SpriteIcon.tsx";

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
  text: string;
  bar: string;
  sprite: SpriteName;
}[] = [
  {
    value: "easy",
    label: "Easy",
    description: "Great for warming up",
    level: 1,
    chip: "bg-difficulty-easy-bg",
    text: "text-difficulty-easy-text",
    bar: "bg-difficulty-easy",
    sprite: "soloToken",
  },
  {
    value: "medium",
    label: "Medium",
    description: "A fair challenge",
    level: 2,
    chip: "bg-difficulty-medium-bg",
    text: "text-difficulty-medium-text",
    bar: "bg-difficulty-medium",
    sprite: "dailyBadge",
  },
  {
    value: "hard",
    label: "Hard",
    description: "For experienced players",
    level: 3,
    chip: "bg-difficulty-hard-bg",
    text: "text-difficulty-hard-text",
    bar: "bg-difficulty-hard",
    sprite: "duelBadge",
  },
  {
    value: "expert",
    label: "Expert",
    description: "The ultimate test",
    level: 4,
    chip: "bg-difficulty-expert-bg",
    text: "text-difficulty-expert-text",
    bar: "bg-difficulty-expert",
    sprite: "expertSpark",
  },
];

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
            className="card w-full flex items-center gap-3.5 px-4 py-3.5 press-spring-soft select-none touch-manipulation focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            onClick={() => onSelect(d.value, assistLevel)}
          >
            <span
              className={`icon-chip w-12 h-12 ${d.text}`}
              aria-hidden="true"
            >
              <SpriteIcon name={d.sprite} className="w-12 h-12" />
            </span>
            <span className="flex-1 text-left">
              <span className={`block text-lg font-bold ${d.text}`}>
                {d.label}
              </span>
              <span className="block caption">{d.description}</span>
            </span>
            <ChevronRight
              size={18}
              className="text-text-muted"
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
