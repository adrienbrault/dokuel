import { beforeEach, describe, expect, it } from "vitest";
import { setLastMultiplayerDifficulty } from "./mp-preferences.ts";
import { createdRoomScreen, pathToScreen, screenToPath } from "./routes.ts";

describe("pathToScreen", () => {
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

  it("plays a past date from the daily archive", () => {
    expect(pathToScreen("/daily/2026-05-16")).toEqual({
      name: "daily",
      date: "2026-05-16",
    });
  });

  it("opens the archive listing at /daily/archive", () => {
    expect(pathToScreen("/daily/archive")).toEqual({ name: "dailyArchive" });
  });

  it("falls back to today's daily for a date with no daily", () => {
    // Hand-edited or stale links must land somewhere playable rather
    // than on a board generated for a day nobody ever saw.
    for (const path of ["/daily/2026-04-30", "/daily/2099-01-01", "/daily/x"]) {
      expect(pathToScreen(path)).toEqual({ name: "daily" });
    }
  });

  it("parses a valid solo path", () => {
    expect(pathToScreen("/solo/hard/abc123")).toMatchObject({
      name: "solo",
      difficulty: "hard",
      gameKey: "abc123",
    });
  });

  it("reads a beat-my-time challenge off a solo link", () => {
    expect(
      pathToScreen("/solo/medium/abc123", "?t=252&by=Swift+Panda"),
    ).toMatchObject({
      name: "solo",
      gameKey: "abc123",
      challenge: { time: 252, by: "Swift Panda" },
    });
  });

  it("opens the board anyway when the challenge params are malformed", () => {
    // A link mangled by a chat client must still play, just without
    // the challenge framing.
    expect(pathToScreen("/solo/medium/abc123", "?t=nope&by=Ann")).toEqual({
      name: "solo",
      difficulty: "medium",
      gameKey: "abc123",
      assistLevel: "standard",
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

  it("round-trips a solo challenge so refreshing keeps it", () => {
    // App canonicalizes the address bar on mount by rewriting it to
    // screenToPath(screen); dropping the query there would strip the
    // challenge from every link the moment it opened.
    const screen = pathToScreen("/solo/medium/abc123", "?t=252&by=Swift+Panda");
    expect(screenToPath(screen)).toBe(
      "/solo/medium/abc123?t=252&by=Swift+Panda",
    );
  });

  it("round-trips the archive listing", () => {
    expect(screenToPath({ name: "dailyArchive" })).toBe("/daily/archive");
  });

  it("round-trips an archived daily date", () => {
    expect(screenToPath(pathToScreen("/daily/2026-05-16"))).toBe(
      "/daily/2026-05-16",
    );
    expect(screenToPath(pathToScreen("/daily"))).toBe("/daily");
  });

  it("round-trips a multiplayer room", () => {
    const screen = pathToScreen("/calm-lamb-g4bb");
    expect(screenToPath(screen)).toBe("/calm-lamb-g4bb");
  });
});

describe("createdRoomScreen", () => {
  beforeEach(() => localStorage.clear());

  it("opens a fresh room on the remembered difficulty", () => {
    // Create Game no longer stops at the difficulty picker, so the
    // screen it navigates to has to arrive carrying a difficulty.
    setLastMultiplayerDifficulty("expert");

    const screen = createdRoomScreen();

    expect(screen).toMatchObject({ name: "multiplayer", difficulty: "expert" });
    expect(pathToScreen(screenToPath(screen))).toMatchObject({
      name: "multiplayer",
    });
  });

  it("mints a different room code every time", () => {
    expect(createdRoomScreen().roomId).not.toBe(createdRoomScreen().roomId);
  });
});
