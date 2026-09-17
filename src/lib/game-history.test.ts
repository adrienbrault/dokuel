import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getGameHistory } from "./game-history.ts";
import { saveMultiplayerGameResult } from "./multiplayer-stats.ts";
import { saveGameResult } from "./stats.ts";

function saveDuel(date: string, won: boolean, opponentName = "Brave Otter") {
  saveMultiplayerGameResult({
    difficulty: "medium",
    assistLevel: "standard",
    time: 300,
    date,
    timestamp: Date.parse(`${date}T12:00:00Z`),
    won,
    opponentName,
    roomId: `room-${date}-${won}`,
    gameNumber: 1,
  });
}

describe("game-history", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists solo wins and duels together, newest first", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    saveGameResult("easy", "standard", 120, true);
    saveDuel("2026-01-02", true);

    expect(getGameHistory().map((entry) => entry.kind)).toEqual([
      "duel",
      "solo",
    ]);
  });

  it("falls back to the date for results stored before stamps existed", () => {
    localStorage.setItem(
      "sudoku_stats",
      JSON.stringify([
        {
          difficulty: "medium",
          assistLevel: "standard",
          time: 400,
          date: "2026-02-10",
          won: true,
        },
      ]),
    );
    saveDuel("2026-02-09", true);

    expect(getGameHistory().map((entry) => entry.kind)).toEqual([
      "solo",
      "duel",
    ]);
  });

  it("orders same-day solo wins by when they were played", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T09:00:00Z"));
    saveGameResult("easy", "standard", 120, true);
    vi.setSystemTime(new Date("2026-03-01T18:00:00Z"));
    saveGameResult("hard", "standard", 600, true);

    expect(getGameHistory().map((entry) => entry.difficulty)).toEqual([
      "hard",
      "easy",
    ]);
  });
});
