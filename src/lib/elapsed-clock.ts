export type ElapsedClockOptions = {
  initialSeconds?: number;
  now?: () => number;
  /** Absolute instant at which the first run should begin. */
  startAt?: number | null;
};

export type ElapsedClock = {
  start: () => void;
  pause: () => number;
  resume: () => void;
  checkpoint: () => number;
  elapsed: () => number;
  finalize: () => number;
};

const defaultNow = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

export function createElapsedClock({
  initialSeconds = 0,
  now = defaultNow,
  startAt = null,
}: ElapsedClockOptions = {}): ElapsedClock {
  let accumulatedMs = initialSeconds * 1_000;
  let runningSince: number | null = null;
  let nextRunStartAt: number | null = startAt;
  let finalized = false;

  const readNow = () => now();

  const elapsedMs = () => {
    if (runningSince === null) return accumulatedMs;
    return accumulatedMs + Math.max(0, readNow() - runningSince);
  };

  const checkpoint = () => {
    if (runningSince !== null) {
      const at = readNow();
      // A shared start can be in the future while both players are
      // waiting through the room countdown. Keep that anchor intact until
      // the clock reaches it; otherwise the first early callback would
      // silently make the game start at the callback time.
      if (at < runningSince) return accumulatedMs / 1_000;
      accumulatedMs += at - runningSince;
      runningSince = at;
    }
    return accumulatedMs / 1_000;
  };

  return {
    start() {
      if (!finalized && runningSince === null) {
        runningSince = nextRunStartAt ?? readNow();
        nextRunStartAt = null;
      }
    },
    pause() {
      const result = checkpoint();
      runningSince = null;
      nextRunStartAt = null;
      return result;
    },
    resume() {
      if (!finalized && runningSince === null) runningSince = readNow();
    },
    checkpoint,
    elapsed() {
      return elapsedMs() / 1_000;
    },
    finalize() {
      const result = checkpoint();
      runningSince = null;
      nextRunStartAt = null;
      finalized = true;
      return result;
    },
  };
}
