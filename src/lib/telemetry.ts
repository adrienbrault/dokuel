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
  flushIntervalMs?: number;
};

const DEFAULT_FLUSH_INTERVAL_MS = 10_000;

export function createTelemetrySender({
  endpoint,
  sessionId,
  sendBeacon = (url, body) => navigator.sendBeacon(url, body),
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
    sendBeacon(endpoint, JSON.stringify({ sid: sessionId, events }));
  };

  return {
    track(event) {
      queue.push(event);
      // Armed on demand rather than as a standing interval: an idle
      // page never wakes up just to find an empty queue.
      timer ??= setTimeout(flush, flushIntervalMs);
    },
    flush,
    dispose() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      queue = [];
    },
  };
}
