import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setMeasurementConsent, trackProductEvent } from "./product-events.ts";

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

it("sends nothing before consent or after withdrawal and only coarse allowed fields after consent", async () => {
  const send = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", send);
  trackProductEvent("visit");
  expect(send).not.toHaveBeenCalled();
  setMeasurementConsent(true);
  trackProductEvent("game_complete", "daily", 131);
  expect(send).toHaveBeenCalledTimes(1);
  expect(JSON.parse(send.mock.calls[0]?.[1].body)).toEqual({
    version: 1,
    event: "game_complete",
    mode: "daily",
    minutes: 2,
  });
  expect(send.mock.calls[0]?.[1]).toMatchObject({
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  setMeasurementConsent(false);
  trackProductEvent("visit");
  expect(send).toHaveBeenCalledTimes(1);
});
