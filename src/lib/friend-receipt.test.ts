import { describe, expect, it } from "vitest";
import {
  compareFriendReceipt,
  createFriendReceipt,
  createFriendRoundChallenge,
  createFriendRoundPlan,
  type FriendReceipt,
  friendReceiptPath,
  parseFriendReceipt,
} from "./friend-receipt.ts";

const puzzle =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179".replace(
    /^5/,
    ".",
  );

const receipt: FriendReceipt = {
  version: 1,
  matchId: "match-123",
  challenge: {
    version: 1,
    puzzle,
    difficulty: "easy",
    assistLevel: "standard",
    timeSeconds: 222,
    hintsUsed: 0,
  },
  challenger: {
    name: "Adrien",
    timeSeconds: 222,
    assistLevel: "standard",
    hintsUsed: 0,
  },
  friend: {
    name: "Luna 🚀",
    timeSeconds: 180.5,
    assistLevel: "standard",
    hintsUsed: 0,
  },
  series: {
    id: "series-123",
    gameNumber: 2,
    challengerWins: 1,
    friendWins: 1,
  },
};

describe("friend result receipts", () => {
  it("round-trips named results and best-of-three state in a shareable path", () => {
    const path = friendReceiptPath(receipt);

    expect(path).toMatch(/^\/receipt\/[A-Za-z0-9_-]+$/);
    expect(parseFriendReceipt(path.slice("/receipt/".length))).toEqual(receipt);
  });

  it("compares both times and turns extra help into a practice result", () => {
    expect(compareFriendReceipt(receipt)).toEqual({
      outcome: "friend",
      deltaSeconds: 41.5,
      challengerCompetitive: true,
      friendCompetitive: true,
    });

    expect(
      compareFriendReceipt({
        ...receipt,
        friend: { ...receipt.friend, hintsUsed: 1 },
      }).outcome,
    ).toBe("practice");
  });

  it("rejects malformed receipt identity, player, and series fields", () => {
    const encoded = (value: unknown) => {
      const bytes = new TextEncoder().encode(JSON.stringify(value));
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary)
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replace(/=+$/, "");
    };
    for (const bad of [
      { ...receipt, version: 2 },
      { ...receipt, matchId: "" },
      { ...receipt, challenger: { ...receipt.challenger, timeSeconds: -1 } },
      { ...receipt, challenger: { ...receipt.challenger, name: " " } },
      {
        ...receipt,
        friend: { ...receipt.friend, name: "x".repeat(65) },
      },
      { ...receipt, friend: { ...receipt.friend, timeSeconds: null } },
      {
        ...receipt,
        friend: { ...receipt.friend, timeSeconds: Number.POSITIVE_INFINITY },
      },
      { ...receipt, friend: { ...receipt.friend, timeSeconds: 1e9 } },
      { ...receipt, friend: { ...receipt.friend, assistLevel: "magic" } },
      { ...receipt, friend: { ...receipt.friend, hintsUsed: 1.5 } },
      {
        ...receipt,
        friend: { ...receipt.friend, hintsUsed: Number.MAX_SAFE_INTEGER },
      },
      { ...receipt, friend: { ...receipt.friend, hintsUsed: 10001 } },
      {
        ...receipt,
        challenge: { ...receipt.challenge, puzzle: `.${"1".repeat(80)}` },
      },
      {
        ...receipt,
        series: { ...receipt.series, friendWins: 2 },
      },
      { ...receipt, series: { ...receipt.series, id: "" } },
      { ...receipt, series: { ...receipt.series, gameNumber: 4 } },
    ]) {
      expect(parseFriendReceipt(encoded(bad))).toBeNull();
    }
    expect(parseFriendReceipt("!".repeat(20))).toBeNull();
  });

  it("plans a fresh setter round without carrying the previous target time", () => {
    const plan = createFriendRoundPlan(receipt, "friend", "again");

    expect(plan).toEqual({
      mode: "again",
      side: "friend",
      difficulty: "easy",
      assistLevel: "standard",
      challengerName: "Adrien",
      friendName: "Luna 🚀",
    });
    expect(plan).not.toHaveProperty("timeSeconds");
    expect(plan).not.toHaveProperty("puzzle");
  });

  it("carries the current result into a fresh best-of-three setter round", () => {
    const plan = createFriendRoundPlan(receipt, "friend", "bestOfThree");

    expect(plan).toMatchObject({
      mode: "bestOfThree",
      side: "friend",
      series: {
        id: "series-123",
        gameNumber: 3,
        challengerWins: 1,
        friendWins: 1,
      },
    });
    expect(plan).not.toHaveProperty("timeSeconds");
  });

  it("preserves named roles and advances the score after a setter round", () => {
    const challenge = {
      ...receipt.challenge,
      puzzle,
      setter: "friend" as const,
      challengerName: receipt.challenger.name,
      friendName: receipt.friend.name,
      series: {
        id: "series-new",
        gameNumber: 2 as const,
        challengerWins: 1 as const,
        friendWins: 0 as const,
      },
    };
    const next = createFriendReceipt({
      matchId: "match-new",
      challenge,
      friendTimeSeconds: 120,
      friendAssistLevel: "standard",
      friendHintsUsed: 0,
    });

    expect(next).toMatchObject({
      challenger: { name: "Adrien", timeSeconds: 120 },
      friend: { name: "Luna 🚀", timeSeconds: 222 },
      series: {
        id: "series-new",
        gameNumber: 2,
        challengerWins: 2,
        friendWins: 0,
      },
    });
  });

  it("rejects a receipt that changes a carried role identity", () => {
    const challenge = {
      ...receipt.challenge,
      setter: "friend" as const,
      challengerName: "Adrien",
      friendName: "Luna 🚀",
    };
    const encoded = friendReceiptPath({
      ...receipt,
      challenge,
      friend: { ...receipt.friend, name: "Impostor" },
    }).slice("/receipt/".length);

    expect(parseFriendReceipt(encoded)).toBeNull();
  });

  it("builds the next challenge from the fresh setter result", () => {
    const plan = createFriendRoundPlan(receipt, "friend", "bestOfThree");
    if (!plan) throw new Error("fixture must have a next round");
    const challenge = createFriendRoundChallenge(
      plan,
      puzzle,
      181.9,
      "standard",
      2,
    );

    expect(challenge).toMatchObject({
      puzzle,
      timeSeconds: 181,
      hintsUsed: 2,
      setter: "friend",
      challengerName: "Adrien",
      friendName: "Luna 🚀",
      series: {
        id: "series-123",
        gameNumber: 3,
        challengerWins: 1,
        friendWins: 1,
      },
    });
  });

  it("does not offer a competitive round after practice or a terminal series", () => {
    expect(
      createFriendRoundPlan(
        {
          ...receipt,
          series: undefined,
          friend: { ...receipt.friend, hintsUsed: 1 },
        },
        "friend",
        "bestOfThree",
      ),
    ).toBeNull();
    expect(
      createFriendRoundPlan(
        {
          ...receipt,
          series: {
            id: "series-done",
            gameNumber: 3,
            challengerWins: 1,
            friendWins: 1,
          },
        },
        "challenger",
        "bestOfThree",
      ),
    ).toBeNull();
    expect(
      createFriendRoundPlan(
        {
          ...receipt,
          series: {
            id: "series-won",
            gameNumber: 2,
            challengerWins: 2,
            friendWins: 0,
          },
        },
        "challenger",
        "bestOfThree",
      ),
    ).toBeNull();
  });

  it("keeps a practice setter round out of the series score", () => {
    const challenge = {
      ...receipt.challenge,
      setter: "friend" as const,
      challengerName: receipt.challenger.name,
      friendName: receipt.friend.name,
      series: {
        id: "series-practice",
        gameNumber: 2 as const,
        challengerWins: 1 as const,
        friendWins: 0 as const,
      },
    };
    const result = createFriendReceipt({
      matchId: "match-practice",
      challenge,
      friendTimeSeconds: 120,
      friendAssistLevel: "full",
      friendHintsUsed: 1,
    });

    expect(result.series).toEqual({
      id: "series-practice",
      gameNumber: 2,
      challengerWins: 1,
      friendWins: 0,
    });
    expect(compareFriendReceipt(result).outcome).toBe("practice");
  });
});
