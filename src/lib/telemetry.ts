/**
 * Anonymous telemetry: a tiny batched sender for error reports and
 * multiplayer connection events, posted to the signaling worker's
 * `/events` route (see signaling/src/events.ts, whose EVENT_SPECS this
 * union mirrors field for field).
 */

export type TelemetryEvent =
  | {
      name: "error";
      source: "window" | "rejection" | "boundary";
      message: string;
      stack: string;
      path: string;
    }
  | { name: "mp_room_mount"; count: number }
  | { name: "mp_ice_servers"; source: IceServersSource; ms: number }
  | { name: "mp_first_peer"; ms: number }
  | { name: "mp_ice_route"; local: string; remote: string }
  | {
      name: "mp_connect_failed";
      reason: string;
      role: "creator" | "joiner";
      ms: number;
    };

export type IceServersSource = "env" | "minted" | "cached" | "none";

export type TelemetrySender = {
  track(event: TelemetryEvent): void;
  flush(): void;
  dispose(): void;
};

export type TelemetrySenderOptions = {
  endpoint: string;
  sessionId: string;
  sendBeacon?: (url: string, body: string) => boolean;
  fetch?: (url: string, init: RequestInit) => Promise<unknown>;
  flushIntervalMs?: number;
};

const DEFAULT_FLUSH_INTERVAL_MS = 10_000;

/** False when the browser has no beacon API, so the fetch fallback runs. */
function defaultSendBeacon(url: string, body: string): boolean {
  if (typeof navigator.sendBeacon !== "function") return false;
  return navigator.sendBeacon(url, body);
}

export function createTelemetrySender({
  endpoint,
  sessionId,
  sendBeacon = defaultSendBeacon,
  fetch = (url, init) => globalThis.fetch(url, init),
  flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS,
}: TelemetrySenderOptions): TelemetrySender {
  let queue: TelemetryEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (queue.length === 0) return;
    const events = queue;
    queue = [];
    const body = JSON.stringify({ sid: sessionId, events });
    try {
      if (sendBeacon(endpoint, body)) return;
    } catch {
      // Fall through to fetch.
    }
    // A string body goes out as text/plain, a CORS-safelisted type:
    // no preflight round trip for a request nobody reads the answer
    // to. The worker parses the text as JSON regardless.
    try {
      fetch(endpoint, {
        method: "POST",
        body,
        keepalive: true,
        credentials: "omit",
      }).catch(() => {
        // Offline or blocked: diagnostics are best-effort.
      });
    } catch {
      // Same.
    }
  };

  // "hidden" is the last point a mobile browser reliably runs script
  // before it freezes or discards the tab; pagehide alone misses iOS
  // app switches.
  const flushIfHidden = () => {
    if (document.visibilityState === "hidden") flush();
  };
  document.addEventListener("visibilitychange", flushIfHidden);

  return {
    track(event) {
      queue.push(event);
      // Armed on demand rather than as a standing interval: an idle
      // page never wakes up just to find an empty queue.
      timer ??= setTimeout(flush, flushIntervalMs);
    },
    flush,
    dispose() {
      document.removeEventListener("visibilitychange", flushIfHidden);
      if (timer !== null) clearTimeout(timer);
      timer = null;
      queue = [];
    },
  };
}
