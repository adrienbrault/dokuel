import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTelemetrySender } from "./telemetry.ts";

const ENDPOINT = "https://signal.example/events";
const SID = "session123";

function beaconSpy(accept = true) {
  return vi.fn((_url: string, _body: string) => accept);
}

function sentEvents(spy: { mock: { calls: unknown[][] } }): unknown[][] {
  return spy.mock.calls.map(
    (call) => (JSON.parse(call[1] as string) as { events: unknown[] }).events,
  );
}

describe("createTelemetrySender", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends events tracked within the flush interval as one beacon", () => {
    const sendBeacon = beaconSpy();
    const sender = createTelemetrySender({
      endpoint: ENDPOINT,
      sessionId: SID,
      sendBeacon,
      flushIntervalMs: 5_000,
    });

    sender.track({ name: "mp_room_mount", count: 1 });
    sender.track({ name: "mp_first_peer", ms: 800 });
    expect(sendBeacon).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5_000);

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0]?.[0]).toBe(ENDPOINT);
    expect(JSON.parse(sendBeacon.mock.calls[0]?.[1] as string)).toEqual({
      sid: SID,
      events: [
        { name: "mp_room_mount", count: 1 },
        { name: "mp_first_peer", ms: 800 },
      ],
    });
    expect(sentEvents(sendBeacon)).toHaveLength(1);
    sender.dispose();
  });

  it("flushes right away when the page is hidden", () => {
    const sendBeacon = beaconSpy();
    const sender = createTelemetrySender({
      endpoint: ENDPOINT,
      sessionId: SID,
      sendBeacon,
    });
    sender.track({ name: "mp_first_peer", ms: 1 });

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));

    expect(sentEvents(sendBeacon)).toEqual([
      [{ name: "mp_first_peer", ms: 1 }],
    ]);
    sender.dispose();
  });

  it("falls back to a keepalive fetch when the beacon is refused", () => {
    const fetchSpy = vi.fn(() => Promise.resolve(new Response(null)));
    const sender = createTelemetrySender({
      endpoint: ENDPOINT,
      sessionId: SID,
      sendBeacon: beaconSpy(false),
      fetch: fetchSpy,
    });

    sender.track({ name: "mp_first_peer", ms: 1 });
    sender.flush();

    expect(fetchSpy).toHaveBeenCalledWith(ENDPOINT, {
      method: "POST",
      body: JSON.stringify({
        sid: SID,
        events: [{ name: "mp_first_peer", ms: 1 }],
      }),
      keepalive: true,
      credentials: "omit",
    });
    sender.dispose();
  });

  it("swallows transport failures instead of throwing into the app", async () => {
    const sender = createTelemetrySender({
      endpoint: ENDPOINT,
      sessionId: SID,
      sendBeacon: () => {
        throw new TypeError("beacon body too large");
      },
      fetch: () => Promise.reject(new TypeError("offline")),
    });

    sender.track({ name: "mp_first_peer", ms: 1 });
    expect(() => sender.flush()).not.toThrow();
    // A rejected fetch left unhandled would fail the run here.
    await vi.runAllTimersAsync();
    sender.dispose();
  });
});
