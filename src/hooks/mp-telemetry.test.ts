import { beforeEach, describe, expect, it } from "vitest";
import { recordRoomMount } from "./mp-telemetry.ts";

describe("recordRoomMount", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns 1 on the first mount", () => {
    expect(recordRoomMount("room-1")).toBe(1);
  });

  it("accumulates mounts within the same hour", () => {
    const now = 1_000_000_000;
    recordRoomMount("room-1", now);
    recordRoomMount("room-1", now + 60_000);
    expect(recordRoomMount("room-1", now + 120_000)).toBe(3);
  });

  it("evicts entries older than one hour", () => {
    const now = 1_000_000_000;
    recordRoomMount("room-1", now);
    recordRoomMount("room-1", now + 30 * 60_000); // 30 min
    // 90 min later — only the 30-min entry should remain (plus this new one).
    expect(recordRoomMount("room-1", now + 90 * 60_000)).toBe(2);
  });

  it("scopes counters per room", () => {
    recordRoomMount("room-a");
    recordRoomMount("room-a");
    expect(recordRoomMount("room-b")).toBe(1);
    expect(recordRoomMount("room-a")).toBe(3);
  });

  it("recovers from malformed JSON in storage", () => {
    localStorage.setItem("dokuel_mp_reloads_room-bad", "{not-json");
    expect(recordRoomMount("room-bad")).toBe(1);
  });
});
