import { useState } from "react";
import { getTechniqueProgress } from "../lib/learning-progress.ts";
import type { HintTechnique, Position } from "../lib/types.ts";

const TECHNIQUE_LABELS: Record<HintTechnique, string> = {
  "naked-single": "Naked Single",
  "hidden-single": "Hidden Single",
  "locked-candidates": "Locked Candidates",
  "naked-pair": "Naked Pair",
  "hidden-pair": "Hidden Pair",
  "naked-triple": "Naked Triple",
  "hidden-triple": "Hidden Triple",
  "naked-quad": "Naked Quad",
  "hidden-quad": "Hidden Quad",
  "x-wing": "X-Wing",
  "xy-wing": "XY-Wing",
  swordfish: "Swordfish",
  mistake: "Mistake",
  reveal: "Reveal",
};

type LearningExerciseProps = {
  technique: HintTechnique;
  puzzle?: string | undefined;
  position?: Position | undefined;
  prompt: string;
  answer: number;
  onSolved: (technique: HintTechnique) => void;
  onAttempt?: ((technique: HintTechnique, solved: boolean) => void) | undefined;
  onClose: () => void;
};

export function LearningExercise({
  technique,
  puzzle,
  position,
  prompt,
  answer,
  onSolved,
  onAttempt,
  onClose,
}: LearningExerciseProps) {
  const [solved, setSolved] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [progress, setProgress] = useState(
    () => getTechniqueProgress()[technique] ?? { attempts: 0, solved: 0 },
  );

  const choose = (digit: number) => {
    if (solved) return;
    const correct = digit === answer;
    onAttempt?.(technique, correct);
    setProgress((current) => ({
      attempts: current.attempts + 1,
      solved: current.solved + (correct ? 1 : 0),
    }));
    if (correct) {
      setSolved(true);
      setFeedback("Correct — you found the next step.");
      onSolved(technique);
    } else {
      setFeedback("Not yet. Recheck the pattern and try again.");
    }
  };

  return (
    <section
      aria-label="Technique practice"
      className="w-full max-w-lg rounded-lg bg-surface border border-border-default px-3 py-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-accent uppercase tracking-wide">
            Focused practice
          </p>
          <h3 className="text-base font-semibold text-text-primary">
            {TECHNIQUE_LABELS[technique]}
          </h3>
        </div>
        <button
          type="button"
          className="text-text-muted text-lg leading-none"
          onClick={onClose}
          aria-label="Close practice"
        >
          ✕
        </button>
      </div>
      <p className="text-sm text-text-secondary mt-2">{prompt}</p>
      {puzzle && position && (
        <PracticeBoard puzzle={puzzle} position={position} />
      )}
      <div
        role="group"
        aria-label="Technique progress"
        className="text-xs text-text-muted mt-2"
      >
        Technique progress: {progress.solved} solved · {progress.attempts}{" "}
        {progress.attempts === 1 ? "attempt" : "attempts"}
      </div>
      <div
        role="group"
        aria-label="Choose a digit"
        className="grid grid-cols-9 gap-1 mt-3"
      >
        {Array.from({ length: 9 }, (_, index) => index + 1).map((digit) => (
          <button
            type="button"
            key={digit}
            className="min-h-10 rounded-md border border-border-default bg-bg-inset text-text-primary font-semibold hover:bg-surface-hover disabled:opacity-60"
            onClick={() => choose(digit)}
            disabled={solved}
            aria-label={`Answer ${digit}`}
          >
            {digit}
          </button>
        ))}
      </div>
      {feedback && (
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-accent mt-2"
        >
          {feedback}
        </p>
      )}
      {solved && (
        <button
          type="button"
          className="btn btn-secondary w-full mt-3"
          onClick={onClose}
        >
          Back to puzzle
        </button>
      )}
    </section>
  );
}

function PracticeBoard({
  puzzle,
  position,
}: {
  puzzle: string;
  position: Position;
}) {
  return (
    <div
      role="grid"
      aria-label="Practice board"
      className="flex flex-col gap-px mt-3 rounded-md overflow-hidden bg-border-default border border-border-default"
    >
      {Array.from({ length: 9 }, (_, row) => (
        <div
          key={row}
          role="row"
          tabIndex={-1}
          className="grid grid-cols-9 gap-px"
        >
          {puzzle
            .slice(row * 9, (row + 1) * 9)
            .split("")
            .map((value, col) => {
              const isTarget = row === position.row && col === position.col;
              const filled = value !== ".";
              return (
                <span
                  key={row + "-" + col}
                  role="gridcell"
                  tabIndex={-1}
                  aria-current={isTarget ? "true" : undefined}
                  aria-label={
                    "Practice cell row " +
                    (row + 1) +
                    " column " +
                    (col + 1) +
                    ", " +
                    (filled ? "value " + value : "empty")
                  }
                  className={`flex aspect-square items-center justify-center text-xs sm:text-sm ${
                    isTarget
                      ? "bg-accent-light text-accent font-bold ring-2 ring-inset ring-accent"
                      : filled
                        ? "bg-bg-raised text-text-primary"
                        : "bg-bg-inset text-text-muted"
                  }`}
                >
                  {filled ? value : "·"}
                </span>
              );
            })}
        </div>
      ))}
    </div>
  );
}
