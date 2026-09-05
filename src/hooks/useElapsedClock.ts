import { useCallback, useEffect, useRef, useState } from "react";
import { createElapsedClock, type ElapsedClock } from "../lib/elapsed-clock.ts";

export type UseElapsedClockOptions = {
  running: boolean;
  initialSeconds?: number;
  startAt?: number | null;
  resetKey?: string | number;
  now?: (() => number) | undefined;
  intervalMs?: number;
};

export type UseElapsedClockResult = {
  seconds: number;
  getElapsedSeconds: () => number;
  pause: () => number;
  resume: () => void;
  checkpoint: () => number;
  finalize: () => number;
};

export function useElapsedClock({
  running,
  initialSeconds = 0,
  startAt = null,
  resetKey,
  now,
  intervalMs = 1_000,
}: UseElapsedClockOptions): UseElapsedClockResult {
  const clockRef = useRef<ElapsedClock | null>(null);
  const keyRef = useRef<string | number | undefined>(resetKey);
  const startedRef = useRef(false);

  if (clockRef.current === null || keyRef.current !== resetKey) {
    clockRef.current = createElapsedClock(
      now === undefined
        ? { initialSeconds, startAt }
        : { initialSeconds, now, startAt },
    );
    keyRef.current = resetKey;
    startedRef.current = false;
  }

  const clock = clockRef.current;
  const [seconds, setSeconds] = useState(initialSeconds);
  const pause = useCallback(() => {
    const current = clock.pause();
    setSeconds(current);
    return current;
  }, [clock]);
  const resume = useCallback(() => {
    clock.resume();
  }, [clock]);
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
      pause();
      return;
    }

    if (startedRef.current) {
      resume();
    } else {
      clock.start();
      startedRef.current = true;
    }

    const interval = setInterval(checkpoint, intervalMs);
    return () => clearInterval(interval);
  }, [clock, running, pause, resume, checkpoint, intervalMs]);

  useEffect(() => {
    return () => {
      clock.pause();
    };
  }, [clock]);

  return { seconds, getElapsedSeconds, pause, resume, checkpoint, finalize };
}
