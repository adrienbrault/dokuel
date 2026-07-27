import { Play } from "lucide-react";

/**
 * Covers the board while a solo game is paused. Blurring rather than
 * hiding keeps the board's shape on screen, so resuming feels like
 * lifting a cover off the puzzle rather than loading a new one — and the
 * blur is what stops a paused player from reading ahead.
 */
export function PauseOverlay({ onResume }: { onResume: () => void }) {
  return (
    <button
      type="button"
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-panel bg-bg-primary/70 backdrop-blur-lg"
      onClick={onResume}
      aria-label="Resume game"
    >
      <span
        className="icon-chip w-14 h-14 rounded-full bg-accent text-text-on-accent"
        style={{ boxShadow: "var(--elevation-accent)" }}
        aria-hidden="true"
      >
        <Play size={24} fill="currentColor" />
      </span>
      <span className="text-base font-semibold text-text-secondary">
        Paused — tap to resume
      </span>
    </button>
  );
}
