import {
  createTelemetrySender,
  flushTelemetry,
  installTelemetry,
  type TelemetryEvent,
} from "./telemetry.ts";

/**
 * Test helper: installs a real sender whose only fake part is the
 * system boundary, `sendBeacon`, and hands back every event that went
 * out. Call `stop()` when done so the next test starts uninstalled.
 */
export function recordTelemetry(): {
  events(): TelemetryEvent[];
  stop(): void;
} {
  const batches: TelemetryEvent[][] = [];
  const stop = installTelemetry(
    createTelemetrySender({
      endpoint: "https://telemetry.test/events",
      sessionId: "test-session",
      sendBeacon: (_url, body) => {
        batches.push((JSON.parse(body) as { events: TelemetryEvent[] }).events);
        return true;
      },
    }),
  );
  return {
    events() {
      flushTelemetry();
      return batches.flat();
    },
    stop,
  };
}
