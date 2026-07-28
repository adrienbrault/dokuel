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
  // Live mirror owned by the interval, so onTick fires from the tick
  // callback instead of inside the updater — updaters must stay pure
  // (StrictMode double-invokes them; here that double-reported ticks
  // to the parent in dev). Not render-synced: several ticks can fire
  // before React renders once.
  const secondsRef = useRef(initialSeconds);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      const next = secondsRef.current + 1;
      secondsRef.current = next;
      setSeconds(next);
      onTickRef.current?.(next);
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  return (
    <span className={className ?? "text-mono text-base"}>
      {formatTime(seconds)}
    </span>
  );
}
