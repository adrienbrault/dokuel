import { useCallback, useEffect, useRef, useState } from "react";
import { createElapsedClock, type ElapsedClock } from "../lib/elapsed-clock.ts";

export type UseElapsedClockOptions = {
  running: boolean;
  initialSeconds?: number;
  resetKey?: string | number;
  now?: () => number;
  intervalMs?: number;
};

export type UseElapsedClockResult = {
  seconds: number;
  getElapsedSeconds: () => number;
  checkpoint: () => number;
  finalize: () => number;
};

export function useElapsedClock({
  running,
  initialSeconds = 0,
  resetKey,
  now,
  intervalMs = 1_000,
}: UseElapsedClockOptions): UseElapsedClockResult {
  const clockRef = useRef<ElapsedClock | null>(null);
  const keyRef = useRef<string | number | undefined>(resetKey);
  const startedRef = useRef(false);

  if (clockRef.current === null || keyRef.current !== resetKey) {
    clockRef.current = createElapsedClock(
      now === undefined ? { initialSeconds } : { initialSeconds, now },
    );
    keyRef.current = resetKey;
    startedRef.current = false;
  }

  const clock = clockRef.current;
  const [seconds, setSeconds] = useState(initialSeconds);
  const checkpoint = useCallback(() => {
    const current = clock.checkpoint();
    setSeconds(current);
    return current;
  }, [clock]);
  const getElapsedSeconds = useCallback(() => clock.elapsed(), [clock]);
  const finalize = useCallback(() => {
    const current = clock.finalize();
    setSeconds(current);
    return current;
  }, [clock]);

  useEffect(() => {
    setSeconds(clock.elapsed());
  }, [clock]);

  useEffect(() => {
    if (!running) {
      setSeconds(clock.pause());
      return;
    }

    if (startedRef.current) {
      clock.resume();
    } else {
      clock.start();
      startedRef.current = true;
    }

    const interval = setInterval(checkpoint, intervalMs);
    return () => clearInterval(interval);
  }, [clock, running, checkpoint, intervalMs]);

  useEffect(() => {
    return () => {
      clock.pause();
    };
  }, [clock]);

  return { seconds, getElapsedSeconds, checkpoint, finalize };
}
