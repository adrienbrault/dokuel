import { beforeEach, describe, expect, it } from "vitest";
import { type FriendReceipt, friendReceiptPath } from "./friend-receipt.ts";
import {
  type RivalryRecord,
  readRivalryHistory,
  recordRivalry,
} from "./rivalry.ts";

const receipt: FriendReceipt = {
  version: 1,
  matchId: "match-history-1",
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

describe("friend rivalry history", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("retains a receipt once and ignores repeated opens of the same match", () => {
    expect(recordRivalry(receipt, 1_700_000_000_000)).toBe(true);
    expect(recordRivalry(receipt, 1_700_000_000_001)).toBe(false);

    const history = readRivalryHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual<RivalryRecord>({
      version: 1,
      recordedAt: 1_700_000_000_000,
      receipt,
    });
  });

  it("drops malformed stored receipts instead of returning unsafe state", () => {
    localStorage.setItem(
      "dokuel_rivalry_history",
      JSON.stringify([
        { version: 1, recordedAt: 1, receipt },
        { version: 1, recordedAt: 2, receipt: { ...receipt, matchId: "" } },
      ]),
    );
    expect(readRivalryHistory()).toHaveLength(1);
    expect(readRivalryHistory()[0]?.receipt.matchId).toBe(receipt.matchId);
    expect(friendReceiptPath(receipt)).toContain("/receipt/");
  });
});
