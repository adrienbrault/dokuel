import { describe, expect, it } from "vitest";
import { challengePath, parseChallenge } from "./challenge.ts";

const puzzle =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179".replace(
    /^5/,
    ".",
  );

describe("friend challenges", () => {
  it("round-trips the exact puzzle and comparison conditions in a shareable path", () => {
    const challenge = {
      version: 1 as const,
      puzzle,
      difficulty: "easy" as const,
      assistLevel: "standard" as const,
      timeSeconds: 222,
      hintsUsed: 0,
    };
    const path = challengePath(challenge);
    expect(path).toMatch(/^\/challenge\/[A-Za-z0-9_-]+$/);
    expect(parseChallenge(path.slice("/challenge/".length))).toEqual(challenge);
  });

  it("rejects malformed or unsupported challenge conditions", () => {
    const valid = {
      version: 1,
      puzzle,
      difficulty: "easy",
      assistLevel: "standard",
      timeSeconds: 222,
      hintsUsed: 0,
    };
    for (const bad of [
      null,
      {},
      { ...valid, version: 2 },
      { ...valid, puzzle: "x".repeat(81) },
      { ...valid, puzzle: `.${"1".repeat(80)}` },
      { ...valid, timeSeconds: -1 },
      { ...valid, timeSeconds: 1.5 },
      { ...valid, assistLevel: "magic" },
      { ...valid, hintsUsed: -1 },
      { ...valid, difficulty: "extreme" },
    ]) {
      expect(parseChallenge(btoa(JSON.stringify(bad)))).toBeNull();
    }
    expect(parseChallenge("a".repeat(2000))).toBeNull();
    expect(parseChallenge("!".repeat(20))).toBeNull();
  });

  it("round-trips setter roles, names, and the score before a fresh round", () => {
    const challenge = {
      version: 1 as const,
      puzzle,
      difficulty: "easy" as const,
      assistLevel: "standard" as const,
      timeSeconds: 222,
      hintsUsed: 1,
      setter: "friend" as const,
      challengerName: "Adrien",
      friendName: "Luna 🚀",
      series: {
        id: "series-123",
        gameNumber: 2 as const,
        challengerWins: 1 as const,
        friendWins: 0 as const,
      },
    };
    const path = challengePath(challenge);
    expect(parseChallenge(path.slice("/challenge/".length))).toEqual(challenge);
  });

  it("rejects incomplete setter identity metadata", () => {
    const valid = {
      version: 1,
      puzzle,
      difficulty: "easy",
      assistLevel: "standard",
      timeSeconds: 222,
      hintsUsed: 0,
      setter: "challenger",
      challengerName: "Adrien",
      friendName: "Luna",
    };
    for (const bad of [
      { ...valid, setter: "spectator" },
      { ...valid, friendName: undefined },
      { ...valid, challengerName: "" },
      { ...valid, friendName: " ".repeat(2) },
      { ...valid, setter: undefined, friendName: 12 },
      { ...valid, friendName: "Luna", challengerName: "x".repeat(65) },
    ]) {
      expect(parseChallenge(btoa(JSON.stringify(bad)))).toBeNull();
    }
  });

  it("accepts the maximum valid UTF-8 role names and series id", () => {
    const challenge = {
      version: 1 as const,
      puzzle,
      difficulty: "easy" as const,
      assistLevel: "standard" as const,
      timeSeconds: 222,
      hintsUsed: 0,
      setter: "challenger" as const,
      challengerName: "é".repeat(32),
      friendName: "x".repeat(64),
      series: {
        id: "s".repeat(96),
        gameNumber: 2 as const,
        challengerWins: 1 as const,
        friendWins: 0 as const,
      },
    };
    const path = challengePath(challenge);
    expect(path.length).toBeGreaterThan(600);
    expect(parseChallenge(path.slice("/challenge/".length))).toEqual(challenge);
  });
});

it("compares times only when the player used no extra assistance or hints", async () => {
  const { compareChallenge } = await import("./challenge.ts");
  const challenge = {
    version: 1 as const,
    puzzle,
    difficulty: "easy" as const,
    assistLevel: "standard" as const,
    timeSeconds: 222,
    hintsUsed: 0,
  };
  expect(
    compareChallenge(challenge, {
      timeSeconds: 200,
      assistLevel: "standard",
      hintsUsed: 0,
    }),
  ).toEqual({ outcome: "beat", seconds: 22 });
  expect(
    compareChallenge(challenge, {
      timeSeconds: 222,
      assistLevel: "standard",
      hintsUsed: 0,
    }).outcome,
  ).toBe("matched");
  expect(
    compareChallenge(challenge, {
      timeSeconds: 240,
      assistLevel: "standard",
      hintsUsed: 0,
    }).outcome,
  ).toBe("finished");
  expect(
    compareChallenge(challenge, {
      timeSeconds: 200,
      assistLevel: "standard",
      hintsUsed: 1,
    }).outcome,
  ).toBe("extra-help");
});
