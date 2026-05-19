import { useEffect, useRef, useState } from "react";
import { formatTime } from "../lib/format.ts";

type TimerProps = {
  running: boolean;
  initialSeconds?: number | undefined;
  onTick?: (seconds: number) => void;
  className?: string | undefined;
};

export function Timer({
  running,
  initialSeconds = 0,
  onTick,
  className,
}: TimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;
        onTickRef.current?.(next);
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  return (
    <span
      className={
        className ??
        "text-xl font-bold tabular-nums tracking-tight text-text-primary leading-none"
      }
    >
      {formatTime(seconds)}
    </span>
  );
}
