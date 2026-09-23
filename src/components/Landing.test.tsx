import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadGame, saveGame } from "../lib/game-storage.ts";
import { saveMultiplayerGameResult } from "../lib/multiplayer-stats.ts";
import { saveGameResult } from "../lib/stats.ts";
import { Landing } from "./Landing.tsx";

const PUZZLE = `1${".".repeat(80)}`;

function saveInProgressGame(key: string) {
  saveGame(key, {
    puzzle: PUZZLE,
    values: `12${".".repeat(79)}`,
    notes: Array.from({ length: 81 }, (): number[] => []),
    timer: 60,
    difficulty: "medium",
    assistLevel: "standard",
    hintsUsed: 0,
  });
}

function renderLanding() {
  render(
    <Landing
      onSolo={vi.fn()}
      onDaily={vi.fn()}
      onCreate={vi.fn()}
      onJoin={vi.fn()}
      onContinue={vi.fn()}
      onStats={vi.fn()}
    />,
  );
}

describe("Landing — in-progress games", () => {
  beforeEach(() => {
    localStorage.clear();
    // A stack of saves belongs to a returning player; keeping the
    // first-timer demo out also keeps these role queries fast.
    saveGameResult("easy", "standard", 240, true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sweeps saves it will never offer on the way in", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
    saveInProgressGame("mp_brave-otter-4f2a_1........");
    vi.setSystemTime(new Date("2026-01-03T10:00:00Z"));

    renderLanding();

    expect(loadGame("mp_brave-otter-4f2a_1........")).toBeNull();
  });

  it("keeps the menu short, folding older games behind a toggle", async () => {
    for (const key of ["a", "b", "c", "d", "e"]) saveInProgressGame(key);

    renderLanding();

    expect(screen.getAllByText("Continue")).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: /2 more/i }));
    expect(screen.getAllByText("Continue")).toHaveLength(5);
  });
});

describe("Landing — gesture demo", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("teaches a first-timer the gestures before the actions", () => {
    renderLanding();

    expect(screen.getByText("How to play")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Start Solo/ }),
    ).toBeInTheDocument();
  });

  it("keeps showing the demo while the first game is still in progress", () => {
    saveInProgressGame("a");

    renderLanding();

    expect(screen.getByText("How to play")).toBeInTheDocument();
  });

  it("drops the demo once any game has been finished", () => {
    saveGameResult("easy", "standard", 240, true);

    renderLanding();

    expect(screen.queryByText("How to play")).not.toBeInTheDocument();
  });

  it("counts a finished duel, even a lost one", () => {
    saveMultiplayerGameResult({
      difficulty: "easy",
      assistLevel: "standard",
      time: 300,
      date: "2026-01-02",
      timestamp: Date.parse("2026-01-02T12:00:00Z"),
      won: false,
      opponentName: "Brave Otter",
      roomId: "room-a",
      gameNumber: 1,
    });

    renderLanding();

    expect(screen.queryByText("How to play")).not.toBeInTheDocument();
  });
});
