import { nextHintStep } from "../lib/learning-hints.ts";
import type { ActiveHint } from "../lib/types.ts";

type HintBannerProps = {
  hint: ActiveHint;
  onDismiss: () => void;
  onAdvance?: (() => void) | undefined;
  onPractice?: (() => void) | undefined;
};

export function HintBanner({
  hint,
  onDismiss,
  onAdvance,
  onPractice,
}: HintBannerProps) {
  const TECHNIQUE_LABELS: Record<typeof hint.technique, string> = {
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
  const techniqueLabel = TECHNIQUE_LABELS[hint.technique];
  const step = hint.step ?? "reveal";
  const stepLabel = step[0]!.toUpperCase() + step.slice(1);
  const nextStep = nextHintStep(step);

  return (
    <div
      role="status"
      aria-atomic="true"
      className="w-full max-w-lg rounded-lg bg-hint-bg border border-hint-border px-3 py-2 animate-modal-content"
    >
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none mt-0.5" aria-hidden="true">
          💡
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-hint-title uppercase tracking-wide">
              {stepLabel}
            </span>
            <span className="text-xs text-hint-muted">{techniqueLabel}</span>
          </div>
          <p className="text-sm text-hint-text mt-0.5 leading-snug">
            {hint.explanation}
          </p>
          {onAdvance && step !== "reveal" && (
            <button
              type="button"
              className="text-xs font-semibold text-hint-title mt-1"
              onClick={onAdvance}
              aria-label={`Show ${nextStep} hint step`}
            >
              Show {nextStep} →
            </button>
          )}
          {onPractice && step === "reveal" && (
            <button
              type="button"
              className="text-xs font-semibold text-hint-title mt-1"
              onClick={onPractice}
              aria-label={`Practice ${techniqueLabel.toLowerCase()}`}
            >
              Practice this {techniqueLabel}
            </button>
          )}
        </div>
        <button
          type="button"
          className="text-hint-muted hover:text-hint-title text-lg leading-none p-0.5 -mt-0.5 -mr-0.5"
          onClick={onDismiss}
          aria-label="Dismiss hint"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
