import type { ActiveHint } from "../lib/types.ts";
import { SpriteIcon } from "./SpriteIcon.tsx";

type HintBannerProps = {
  hint: ActiveHint;
  onDismiss: () => void;
};

export function HintBanner({ hint, onDismiss }: HintBannerProps) {
  const techniqueLabel =
    hint.technique === "naked-single" ? "Naked Single" : "Hidden Single";

  return (
    <div className="w-full max-w-lg rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-3 py-2 animate-modal-content">
      <div className="flex items-start gap-2">
        <SpriteIcon name="hintToken" className="w-7 h-7 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
            {techniqueLabel}
          </span>
          <p className="text-sm text-amber-900 dark:text-amber-100 mt-0.5 leading-snug">
            {hint.explanation}
          </p>
        </div>
        <button
          type="button"
          className="text-amber-400 dark:text-amber-600 hover:text-amber-600 dark:hover:text-amber-400 text-lg leading-none p-0.5 -mt-0.5 -mr-0.5"
          onClick={onDismiss}
          aria-label="Dismiss hint"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
