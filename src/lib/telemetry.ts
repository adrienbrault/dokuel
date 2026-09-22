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

export function createTelemetrySender(
  _options: TelemetrySenderOptions,
): TelemetrySender {
  return { track() {}, flush() {}, dispose() {} };
}
