import { useMemo } from "react";
import { ghostPercentAt } from "../lib/challenge.ts";
import type { GhostSample } from "../lib/types.ts";

/**
 * Replays a challenger's recorded progress timeline against the
 * friend's own elapsed time. The caller already re-renders every second
 * via its game timer, so the ghost advances smoothly with no timer of
 * its own.
 */
export function useGhostPlayback({
  samples,
  elapsedSeconds,
}: {
  samples: GhostSample[];
  elapsedSeconds: number;
}): { ghostPercent: number; ghostFinished: boolean } {
  return useMemo(() => {
    const last = samples[samples.length - 1];
    return {
      ghostPercent: ghostPercentAt(samples, elapsedSeconds),
      ghostFinished: last ? elapsedSeconds >= last.t : true,
    };
  }, [samples, elapsedSeconds]);
}
