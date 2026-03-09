import { formatTime } from "../lib/format.ts";
import { ProgressBar } from "./ProgressBar.tsx";
import { Timer } from "./Timer.tsx";

export function TimerButton({
  status,
  paused,
  setPaused,
  revealed,
  initialSeconds,
  onTick,
  progressPercent,
  personalBest,
}: {
  status: string;
  paused: boolean;
  setPaused: (fn: (p: boolean) => boolean) => void;
  revealed: boolean;
  initialSeconds: number | undefined;
  onTick: (s: number) => void;
  progressPercent: number;
  personalBest: number | null;
}) {
  return (
    <button
      type="button"
      className="flex flex-col items-center touch-manipulation"
      onClick={() => {
        if (status === "playing") setPaused((p) => !p);
      }}
      aria-label={paused ? "Resume" : "Pause"}
    >
      <Timer
        running={status === "playing" && !paused && revealed}
        initialSeconds={initialSeconds}
        onTick={onTick}
      />
      {paused ? (
        <span className="text-xs text-text-muted">Paused</span>
      ) : (
        <div className="flex items-center gap-2 w-32">
          <ProgressBar percent={progressPercent} color="bg-accent" />
        </div>
      )}
      {!paused && personalBest !== null && (
        <span className="text-xs text-text-muted font-mono tabular-nums">
          PB {formatTime(personalBest)}
        </span>
      )}
    </button>
  );
}
