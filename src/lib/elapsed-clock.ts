export type ElapsedClockOptions = {
  initialSeconds?: number;
  now?: () => number;
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
}: ElapsedClockOptions = {}): ElapsedClock {
  let accumulatedMs = initialSeconds * 1_000;
  let runningSince: number | null = null;
  let finalized = false;

  const readNow = () => now();

  const elapsedMs = () => {
    if (runningSince === null) return accumulatedMs;
    return accumulatedMs + Math.max(0, readNow() - runningSince);
  };

  const checkpoint = () => {
    if (runningSince !== null) {
      const at = readNow();
      accumulatedMs += Math.max(0, at - runningSince);
      runningSince = at;
    }
    return accumulatedMs / 1_000;
  };

  return {
    start() {
      if (!finalized && runningSince === null) runningSince = readNow();
    },
    pause() {
      const result = checkpoint();
      runningSince = null;
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
      finalized = true;
      return result;
    },
  };
}
