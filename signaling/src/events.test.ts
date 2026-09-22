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

  it("fills fields a client left out with empty values", async () => {
    const { dataset, writeDataPoint } = fakeDataset();

    await handleEvents(
      post({ sid: SID, events: [{ name: "mp_connect_failed" }] }),
      { EVENTS: dataset },
    );

    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["mp_connect_failed"],
      blobs: ["mp_connect_failed", SID, "", ""],
      doubles: [0],
    });
  });

  it("accepts and drops a valid batch when no dataset is bound", async () => {
    const response = await handleEvents(
      post({ sid: SID, events: [{ name: "mp_first_peer", ms: 5 }] }),
      {},
    );

    expect(response.status).toBe(204);
  });

  const valid = { name: "mp_first_peer", ms: 1 };

  it.each([
    ["invalid JSON", "{not json"],
    ["a non-object body", [valid]],
    ["a missing session id", { events: [valid] }],
    ["a session id with odd characters", { sid: "a b<c>d e", events: [valid] }],
    ["a too-long session id", { sid: "a".repeat(65), events: [valid] }],
    ["events that are not an array", { sid: SID, events: valid }],
    ["an empty batch", { sid: SID, events: [] }],
    ["an oversized batch", { sid: SID, events: Array(26).fill(valid) }],
    ["an event that is not an object", { sid: SID, events: ["error"] }],
    ["an unknown event name", { sid: SID, events: [{ name: "pageview" }] }],
    [
      "an unknown field",
      { sid: SID, events: [{ name: "mp_first_peer", ms: 1, ip: "1.2.3.4" }] },
    ],
    [
      "a string field over its limit",
      {
        sid: SID,
        events: [{ name: "error", message: "x".repeat(301) }],
      },
    ],
    [
      "a string where a number belongs",
      { sid: SID, events: [{ name: "mp_first_peer", ms: "1" }] },
    ],
    [
      "a non-finite number",
      { sid: SID, events: [{ name: "mp_first_peer", ms: null }] },
    ],
    [
      "a number where a string belongs",
      { sid: SID, events: [{ name: "error", message: 42 }] },
    ],
    [
      "an oversized body",
      `{"sid":"${SID}","events":[],"pad":"${"x".repeat(40_000)}"}`,
    ],
  ])("rejects %s with 400 and records nothing", async (_label, body) => {
    const { dataset, writeDataPoint } = fakeDataset();

    const response = await handleEvents(post(body), { EVENTS: dataset });

    expect(response.status).toBe(400);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });
});
