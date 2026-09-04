import { formatTime } from "../lib/format.ts";

type TimerProps = {
  seconds: number;
  className?: string | undefined;
};

export function Timer({ seconds, className }: TimerProps) {
  return (
    <span className={className ?? "text-mono text-base"}>
      {formatTime(seconds)}
    </span>
  );
}
