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

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

/**
 * Where telemetry goes, or null for nowhere. Only a production build
 * on a real host reports by default: dev servers, the test suite and
 * Playwright's local preview server stay silent so local runs never
 * land in the production dataset. `VITE_TELEMETRY_URL` overrides that
 * in either direction ("off" disables, a URL redirects).
 */
export function resolveTelemetryEndpoint({
  override,
  prod,
  hostname,
  defaultUrl,
}: {
  override: string | undefined;
  prod: boolean;
  hostname: string;
  defaultUrl: string;
}): string | null {
  if (override === "off") return null;
  if (override) return override;
  if (!prod || LOCAL_HOSTNAMES.has(hostname)) return null;
  return defaultUrl;
}

const DEFAULT_FLUSH_INTERVAL_MS = 10_000;
// The worker refuses batches over 25 events; stay clear of it.
const MAX_BATCH = 20;
const MAX_QUEUE = 100;

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

  const send = (events: TelemetryEvent[]) => {
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

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    const events = queue;
    queue = [];
    for (let start = 0; start < events.length; start += MAX_BATCH) {
      send(events.slice(start, start + MAX_BATCH));
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
      // Past the cap the newest events are the ones dropped: in a
      // runaway loop the first occurrences are the informative ones.
      if (queue.length >= MAX_QUEUE) return;
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

let active: TelemetrySender | null = null;

/**
 * Make `sender` the one every {@link track} call goes to. Returns the
 * uninstaller, which also disposes the sender.
 */
export function installTelemetry(sender: TelemetrySender): () => void {
  active?.dispose();
  active = sender;
  return () => {
    if (active !== sender) return;
    sender.dispose();
    active = null;
  };
}

/** Record an event. A no-op until a sender is installed; never throws. */
export function track(event: TelemetryEvent): void {
  try {
    active?.track(event);
  } catch {
    // Diagnostics must never break the thing they diagnose.
  }
}

/** Send whatever is queued now instead of at the next interval. */
export function flushTelemetry(): void {
  try {
    active?.flush();
  } catch {
    // Same.
  }
}
