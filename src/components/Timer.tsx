import { Fragment, useEffect, useRef, useState } from "react";
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

  // The colon breathes (see .timer-colon) — the digits themselves stay
  // still, so the running state shows without the numbers jittering.
  const parts = formatTime(seconds).split(":");
  return (
    <span className={className ?? "text-mono text-base"}>
      {parts.map((part, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: positional segments
        <Fragment key={i}>
          {i > 0 && <span className="timer-colon">:</span>}
          {part}
        </Fragment>
      ))}
    </span>
  );
}
