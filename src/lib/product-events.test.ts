import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  getMeasurementConsent,
  setMeasurementConsent,
  trackProductEvent,
} from "./product-events.ts";

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

it("fails closed for corrupt consent and tolerates failed event delivery", async () => {
  localStorage.setItem("dokuel_measurement_consent", '"yes"');
  expect(getMeasurementConsent()).toBe(false);
  const send = vi.fn().mockRejectedValue(new Error("offline"));
  vi.stubGlobal("fetch", send);
  setMeasurementConsent(true);
  trackProductEvent("game_complete", "solo", Number.NaN);
  await Promise.resolve();
  expect(JSON.parse(send.mock.calls[0]?.[1].body).minutes).toBe(0);
  trackProductEvent("game_complete", "solo", 1e9);
  await Promise.resolve();
  expect(JSON.parse(send.mock.calls[1]?.[1].body).minutes).toBe(240);
});
