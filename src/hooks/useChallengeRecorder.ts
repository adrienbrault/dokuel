import { useCallback, useEffect, useRef, useState } from "react";
import type { GhostSample } from "../lib/types.ts";

/**
 * Records a challenger's progress timeline while they solve, so the
 * solve can later be shared as an async challenge and replayed as a
 * ghost. A sample is captured only when completion percent rises — the
 * timeline is monotonic, so a ghost bar never rewinds. Per-percent-step
 * granularity keeps a whole solve to roughly fifty samples.
 *
 * The recorder owns its own persistence (a localStorage key separate
 * from the game autosave) so a long solve survives a page refresh.
 */

const SEED: GhostSample[] = [{ t: 0, p: 0 }];

function ghostStorageKey(key: string): string {
  return `dokuel_ghost_${key}`;
}

function isSample(value: unknown): value is GhostSample {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return typeof s.t === "number" && typeof s.p === "number";
}

function loadGhost(storageKey: string | undefined): GhostSample[] {
  if (!storageKey) return [...SEED];
  try {
    const raw = localStorage.getItem(ghostStorageKey(storageKey));
    if (raw) {
      const data: unknown = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0 && data.every(isSample)) {
        return data;
      }
    }
  } catch {
    // unreadable / unavailable — fall through to a fresh timeline
  }
  return [...SEED];
}

function saveGhost(
  storageKey: string | undefined,
  samples: GhostSample[],
): void {
  if (!storageKey) return;
  try {
    localStorage.setItem(ghostStorageKey(storageKey), JSON.stringify(samples));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function useChallengeRecorder({
  completionPercent,
  getTimerSeconds,
  storageKey,
}: {
  /** Current board completion percent (0–100). */
  completionPercent: number;
  /** Reads the current elapsed time; called when a sample is captured. */
  getTimerSeconds: () => number;
  /** Persistence key. When omitted, the timeline is in-memory only. */
  storageKey: string | undefined;
}): { samples: GhostSample[]; reset: () => void } {
  const [samples, setSamples] = useState<GhostSample[]>(() =>
    loadGhost(storageKey),
  );
  const samplesRef = useRef(samples);

  useEffect(() => {
    const last = samplesRef.current[samplesRef.current.length - 1]!;
    // Capture only forward progress — a dip (erase, undo) records nothing.
    if (completionPercent <= last.p) return;
    const next: GhostSample[] = [
      ...samplesRef.current,
      { t: getTimerSeconds(), p: completionPercent },
    ];
    samplesRef.current = next;
    saveGhost(storageKey, next);
    setSamples(next);
  }, [completionPercent, getTimerSeconds, storageKey]);

  const reset = useCallback(() => {
    const seed = [...SEED];
    samplesRef.current = seed;
    saveGhost(storageKey, seed);
    setSamples(seed);
  }, [storageKey]);

  return { samples, reset };
}
