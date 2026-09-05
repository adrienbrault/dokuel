import { describe, expect, it } from "vitest";
import { pathToScreen, screenToPath } from "./lib/navigation.ts";

describe("pathToScreen", () => {
  it("round-trips a dated daily resume link", () => {
    const screen = pathToScreen("/daily/2025-01-02");
    expect(screen).toEqual({ name: "daily", date: "2025-01-02" });
    expect(screenToPath(screen)).toBe("/daily/2025-01-02");
    expect(pathToScreen("/daily/2025-02-30")).toEqual({
      name: "notFound",
      path: "/daily/2025-02-30",
    });
  });
  it("maps the static screens", () => {
    expect(pathToScreen("/")).toEqual({ name: "landing" });
    expect(pathToScreen("/daily")).toEqual({ name: "daily" });
    expect(pathToScreen("/join")).toEqual({ name: "join" });
    expect(pathToScreen("/stats")).toEqual({ name: "stats" });
  });

  it("treats a room-code-shaped path as a multiplayer room", () => {
    expect(pathToScreen("/loud-duck-7kmq")).toEqual({
      name: "multiplayer",
      roomId: "loud-duck-7kmq",
      difficulty: null,
    });
  });

  it("normalizes room-code case from pasted links", () => {
    // Messaging apps and mobile keyboards capitalize; Yjs room names
    // are case-sensitive, so "Loud-Duck-7KMQ" would otherwise be a
    // DIFFERENT, empty room the joiner waits in forever.
    expect(pathToScreen("/Loud-Duck-7KMQ")).toEqual({
      name: "multiplayer",
      roomId: "loud-duck-7kmq",
      difficulty: null,
    });
  });

  it("still accepts legacy two-word room codes", () => {
    expect(pathToScreen("/loud-duck")).toEqual({
      name: "multiplayer",
      roomId: "loud-duck",
      difficulty: null,
    });
  });

  it("rejects room codes longer than the signaling shard key", () => {
    // The worker truncates its Durable Object key at 64 chars, so an
    // oversized code would silently split players across shards (and a
    // multi-KB path would become a Yjs room name). Overlong codes are
    // a 404, not a room.
    const oversized = `/${"a".repeat(40)}-${"b".repeat(40)}`;
    expect(pathToScreen(oversized)).toEqual({
      name: "notFound",
      path: oversized,
    });
  });

  it("does not turn arbitrary junk paths into rooms", () => {
    // Every typo'd URL used to boot the whole WebRTC stack and open a
    // signaling connection for a room named after the typo.
    for (const path of ["/statss", "/index.html", "/favicon.ico", "/x!/y"]) {
      expect(pathToScreen(path)).toEqual({ name: "notFound", path });
    }
  });

  it("parses a valid solo path", () => {
    expect(pathToScreen("/solo/hard/abc123")).toMatchObject({
      name: "solo",
      difficulty: "hard",
      gameKey: "abc123",
    });
  });

  it("falls back to landing for malformed solo paths", () => {
    expect(pathToScreen("/solo/nope/abc")).toEqual({ name: "landing" });
    expect(pathToScreen("/solo/easy/")).toEqual({ name: "landing" });
  });
});

describe("screenToPath", () => {
  it("keeps the offending path for the not-found screen", () => {
    expect(screenToPath({ name: "notFound", path: "/statss" })).toBe("/statss");
  });

  it("round-trips a multiplayer room", () => {
    const screen = pathToScreen("/calm-lamb-g4bb");
    expect(screenToPath(screen)).toBe("/calm-lamb-g4bb");
  });
});
