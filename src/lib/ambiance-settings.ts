const STORAGE_KEY = "dokuel_ambiance";

// In-memory cache doubles as the storage-denied fallback, as in
// sounds.ts: reads happen during render and must never throw.
let enabledCache: boolean | null = null;
const listeners = new Set<() => void>();

export function getAmbianceEnabled(): boolean {
  if (enabledCache === null) {
    try {
      enabledCache = localStorage.getItem(STORAGE_KEY) !== "false";
    } catch {
      enabledCache = true;
    }
  }
  return enabledCache;
}

export function setAmbianceEnabled(enabled: boolean) {
  enabledCache = enabled;
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Storage unavailable — the in-memory value still applies for this
    // session.
  }
  for (const listener of listeners) listener();
}

/** useSyncExternalStore-shaped subscription. */
export function subscribeAmbianceEnabled(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
