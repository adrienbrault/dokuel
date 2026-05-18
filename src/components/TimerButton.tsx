import { formatTime } from "../lib/format.ts";
import { Timer } from "./Timer.tsx";

type TimerButtonProps = {
  running: boolean;
  initialSeconds: number;
  paused: boolean;
  cellsFilled: number;
  personalBest: number | null;
  onTogglePause: () => void;
  onTick: (s: number) => void;
};

export function TimerButton({
  running,
  initialSeconds,
  paused,
  cellsFilled,
  personalBest,
  onTogglePause,
  onTick,
}: TimerButtonProps) {
  return (
    <button
      type="button"
      className="flex flex-col items-center touch-manipulation"
      onClick={onTogglePause}
      aria-label={paused ? "Resume" : "Pause"}
    >
      <Timer
        running={running}
        initialSeconds={initialSeconds}
        onTick={onTick}
      />
      <span className="text-xs text-text-muted font-mono tabular-nums">
        {paused ? (
          "Paused"
        ) : (
          <>
            <span className="text-accent font-medium">{cellsFilled}</span>
            /81
            {personalBest !== null && ` · PB ${formatTime(personalBest)}`}
          </>
        )}
      </span>
    </button>
  );
}
