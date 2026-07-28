import type { ActiveHint } from "../lib/types.ts";

type HintBannerProps = {
  hint: ActiveHint;
  onDismiss: () => void;
};

export function HintBanner({ hint, onDismiss }: HintBannerProps) {
  const techniqueLabel =
    hint.technique === "naked-single" ? "Naked Single" : "Hidden Single";

  return (
    <div className="w-full max-w-lg rounded-[10px] bg-cell-hint-bg border border-difficulty-medium-text/25 px-3 py-2 animate-modal-content">
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none mt-0.5" aria-hidden="true">
          💡
        </span>
        <div className="flex-1 min-w-0">
          <span className="font-mono text-[0.6875rem] font-medium text-difficulty-medium-text uppercase tracking-[0.08em]">
            {techniqueLabel}
          </span>
          <p className="text-sm text-text-primary mt-0.5 leading-snug">
            {hint.explanation}
          </p>
        </div>
        <button
          type="button"
          className="text-text-muted hover:text-text-primary transition-colors text-lg leading-none p-0.5 -mt-0.5 -mr-0.5"
          onClick={onDismiss}
          aria-label="Dismiss hint"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
