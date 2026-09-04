// @vitest-environment node
import { expect, it, vi } from "vitest";
import { generateTurnCredentials } from "../src/turn-credentials.ts";

it("does not mint credentials after the trusted client IP reaches its limit", async () => {
  const mint = vi.spyOn(globalThis, "fetch");
  const limit = vi.fn().mockResolvedValue({ success: false });
  const response = await generateTurnCredentials(new Request("https://signal.dokuel.com/turn-credentials", {
    headers: { "CF-Connecting-IP": "192.0.2.1" },
  }), { TURN_KEY_ID: "test-key", TURN_KEY_API_TOKEN: "test-token", TURN_RATE_LIMITER: { limit } });
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("60");
  expect(limit).toHaveBeenCalledWith({ key: "turn:192.0.2.1" });
  expect(mint).not.toHaveBeenCalled();
});

it("returns a retryable response when credential minting loses its connection", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
  const response = await generateTurnCredentials(new Request("https://signal.dokuel.com/turn-credentials"), {
    TURN_KEY_ID: "test-key", TURN_KEY_API_TOKEN: "test-token",
    TURN_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({success:true}) },
  });
  expect(response.status).toBe(502);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
