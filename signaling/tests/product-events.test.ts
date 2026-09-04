import { expect, it, vi } from "vitest";
import { collectProductEvent } from "../src/product-events";

it("collects only the fixed anonymous schema and rejects extra identifying fields", async () => {
  const writeDataPoint = vi.fn();
  const env = { PRODUCT_ANALYTICS: { writeDataPoint }, EVENT_RATE_LIMITER: { limit: async () => ({ success: true }) } };
  const request = (payload: unknown) => new Request("https://signal.dokuel.com/events", {
    method: "POST", body: JSON.stringify(payload),
  });
  const event = { version: 1, event: "game_complete", mode: "daily", minutes: 2 };
  expect((await collectProductEvent(request({ ...event, playerId: "private" }), env)).status).toBe(400);
  expect(writeDataPoint).not.toHaveBeenCalled();
  expect((await collectProductEvent(request(event), env)).status).toBe(204);
  expect(writeDataPoint).toHaveBeenCalledWith({ blobs: ["game_complete", "daily"], doubles: [1, 2] });
});
