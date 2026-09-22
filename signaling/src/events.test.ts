import { describe, expect, it, vi } from "vitest";
import { handleEvents } from "./events";

function fakeDataset() {
  const writeDataPoint = vi.fn<AnalyticsEngineDataset["writeDataPoint"]>();
  return { dataset: { writeDataPoint }, writeDataPoint };
}

function post(body: unknown): Request {
  return new Request("https://signal.dokuel.com/events", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const SID = "0f8b4c1e-session";

describe("handleEvents", () => {
  it("writes one data point per event, keyed by event name", async () => {
    const { dataset, writeDataPoint } = fakeDataset();

    const response = await handleEvents(
      post({
        sid: SID,
        events: [
          { name: "mp_first_peer", ms: 1234 },
          {
            name: "error",
            source: "window",
            message: "boom",
            stack: "at x",
            path: "/:room",
          },
        ],
      }),
      { EVENTS: dataset },
    );

    expect(response.status).toBe(204);
    expect(writeDataPoint.mock.calls).toEqual([
      [
        {
          indexes: ["mp_first_peer"],
          blobs: ["mp_first_peer", SID],
          doubles: [1234],
        },
      ],
      [
        {
          indexes: ["error"],
          blobs: ["error", SID, "window", "boom", "at x", "/:room"],
          doubles: [],
        },
      ],
    ]);
  });
});
