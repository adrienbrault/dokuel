import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as dateModule from "../lib/date.ts";
import { getMultiplayerStats } from "../lib/multiplayer-stats.ts";
import { useRecordMultiplayerMatch } from "./useRecordMultiplayerMatch.ts";

describe("useRecordMultiplayerMatch", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("stamps the record with the app's local calendar date", () => {
    // Same convention as everywhere else in the app (date.ts):
    // toISOString() reports the UTC date, which is tomorrow for an
    // evening match in any western timezone.
    vi.spyOn(dateModule, "todayLocalISO").mockReturnValue("2001-02-03");

    renderHook(() =>
      useRecordMultiplayerMatch({
        gameOver: { winnerId: "p1", winnerName: "Me" },
        roomId: "room-date",
        gameNumber: 1,
        difficulty: "easy",
        assistLevel: "standard",
        playerId: "p1",
        opponentName: "Bob",
        getTimeSeconds: () => 90,
      }),
    );

    expect(getMultiplayerStats()[0]!.date).toBe("2001-02-03");
  });
});
