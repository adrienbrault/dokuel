import { describe, expect, it } from "vitest";
import { type FriendReceipt, friendReceiptPath } from "./friend-receipt.ts";
import { pathToScreen, screenToPath } from "./navigation.ts";

const receipt: FriendReceipt = {
  version: 1,
  matchId: "route-1",
  challenge: {
    version: 1,
    puzzle:
      ".34678912672195348198342567859761423426853791713924856961537284287419635345286179",
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
    name: "Luna",
    timeSeconds: 180,
    assistLevel: "standard",
    hintsUsed: 0,
  },
};

describe("receipt navigation", () => {
  it("round-trips a validated receipt route", () => {
    const path = friendReceiptPath(receipt);
    expect(screenToPath(pathToScreen(path))).toBe(path);
    expect(pathToScreen(path)).toEqual({ name: "receipt", receipt });
  });

  it("treats an invalid receipt payload as a not-found route", () => {
    expect(pathToScreen("/receipt/not-valid!")).toEqual({
      name: "notFound",
      path: "/receipt/not-valid!",
    });
  });

  it("round-trips a fresh setter round route with a selected role", () => {
    const receiptPath = friendReceiptPath(receipt);
    const payload = receiptPath.slice("/receipt/".length);
    const screen = {
      name: "friendRound" as const,
      receipt,
      side: "friend" as const,
      mode: "bestOfThree" as const,
    };
    const path = screenToPath(screen);

    expect(path).toBe(`/friend-round/${payload}/friend/bestOfThree`);
    expect(pathToScreen(path)).toEqual(screen);
  });

  it("rejects an invalid setter round mode or side", () => {
    const payload = friendReceiptPath(receipt).slice("/receipt/".length);
    for (const path of [
      `/friend-round/${payload}/spectator/again`,
      `/friend-round/${payload}/friend/target`,
      `/friend-round/${payload}/friend/again/extra`,
    ]) {
      expect(pathToScreen(path)).toEqual({ name: "notFound", path });
    }
  });
});
