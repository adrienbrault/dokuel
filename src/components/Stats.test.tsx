import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveMultiplayerGameResult } from "../lib/multiplayer-stats.ts";
import { saveArchivedReplay } from "../lib/replay-archive.ts";
import { saveGameResult } from "../lib/stats.ts";
import { Stats } from "./Stats.tsx";

describe("Stats page — solo section", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("shows a separate row for each assist mode played at a difficulty", () => {
    saveGameResult("easy", "paper", 300, true);
    saveGameResult("easy", "full", 120, true);

    render(<Stats onBack={vi.fn()} />);

    const section = screen.getByRole("region", { name: /solo/i });
    expect(within(section).getByText("Paper")).toBeTruthy();
    expect(within(section).getByText("Full")).toBeTruthy();
    expect(within(section).getAllByText("05:00").length).toBeGreaterThan(0);
    expect(within(section).getAllByText("02:00").length).toBeGreaterThan(0);
  });

  it("counts wins across every assist mode in the difficulty header", () => {
    saveGameResult("medium", "paper", 300, true);
    saveGameResult("medium", "standard", 200, true);
    saveGameResult("medium", "full", 100, true);

    render(<Stats onBack={vi.fn()} />);

    const section = screen.getByRole("region", { name: /solo/i });
    expect(within(section).getByText("3 wins")).toBeTruthy();
  });
});

describe("Stats page — multiplayer section", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("shows an empty-state hint when no multiplayer games have been played", () => {
    render(<Stats onBack={vi.fn()} />);

    const section = screen.getByRole("region", { name: /multiplayer/i });
    expect(within(section).getByText(/no multiplayer games yet/i)).toBeTruthy();
  });

  it("shows multiplayer summary numbers when games exist", () => {
    saveMultiplayerGameResult({
      difficulty: "medium",
      assistLevel: "standard",
      time: 300,
      date: "2026-05-19",
      timestamp: 1,
      won: true,
      opponentName: "Brave Otter",
      roomId: "room-1",
      gameNumber: 1,
    });
    saveMultiplayerGameResult({
      difficulty: "medium",
      assistLevel: "standard",
      time: 420,
      date: "2026-05-19",
      timestamp: 2,
      won: false,
      opponentName: "Clever Fox",
      roomId: "room-2",
      gameNumber: 1,
    });

    render(<Stats onBack={vi.fn()} />);

    const section = screen.getByRole("region", { name: /multiplayer/i });
    // The summary card pairs each value with its label as adjacent text;
    // find by walking from the label up.
    const playedLabel = within(section).getAllByText(/^Played$/i)[0];
    expect(playedLabel?.parentElement?.textContent).toMatch(/2Played/);
    const winsLabel = within(section).getByText(/^Wins$/i);
    expect(winsLabel.parentElement?.textContent).toMatch(/1Wins/);
    const lossesLabel = within(section).getByText(/^Losses$/i);
    expect(lossesLabel.parentElement?.textContent).toMatch(/1Losses/);
    expect(within(section).getAllByText("50%").length).toBeGreaterThanOrEqual(
      1,
    );
  });
});

describe("Stats page — history section", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("names the opponent, time, and outcome of a duel", () => {
    saveMultiplayerGameResult({
      difficulty: "hard",
      assistLevel: "standard",
      time: 245,
      date: "2026-05-19",
      timestamp: 1,
      won: true,
      opponentName: "Brave Otter",
      roomId: "room-1",
      gameNumber: 1,
    });

    render(<Stats onBack={vi.fn()} />);

    const section = screen.getByRole("region", { name: /history/i });
    const row = within(section).getByRole("listitem");
    expect(within(row).getByText(/brave otter/i)).toBeTruthy();
    expect(within(row).getByText("04:05")).toBeTruthy();
    expect(within(row).getByText(/won/i)).toBeTruthy();
  });

  it("replays a duel whose moves were archived", () => {
    const duel = {
      difficulty: "hard" as const,
      assistLevel: "standard" as const,
      time: 245,
      date: "2026-05-19",
      won: true,
      opponentName: "Brave Otter",
    };
    saveMultiplayerGameResult({
      ...duel,
      timestamp: 1,
      roomId: "room-old",
      gameNumber: 1,
    });
    saveMultiplayerGameResult({
      ...duel,
      timestamp: 2,
      roomId: "room-1",
      gameNumber: 1,
    });
    saveArchivedReplay({
      roomId: "room-1",
      gameNumber: 1,
      puzzle: `.${"1".repeat(80)}`,
      solution: null,
      me: { name: "You", color: "#3B82F6", won: true, frames: [[0, 0, 2]] },
      opponent: {
        name: "Brave Otter",
        color: "#EF4444",
        won: false,
        frames: [[900, 0, 3]],
      },
    });
    render(<Stats onBack={vi.fn()} />);

    // Only the archived duel offers one: older matches were never recorded.
    const replayButtons = screen.getAllByRole("button", { name: /^Replay/ });
    expect(replayButtons).toHaveLength(1);
    fireEvent.click(replayButtons[0]!);

    expect(
      screen.getByRole("group", { name: "Board: Brave Otter" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Stats/ }));
    expect(
      screen.queryByRole("group", { name: "Board: Brave Otter" }),
    ).toBeNull();
  });

  it("logs solo wins and duels together, newest first", () => {
    saveGameResult("easy", "standard", 120, true);
    saveMultiplayerGameResult({
      difficulty: "hard",
      assistLevel: "standard",
      time: 245,
      date: "2026-05-19",
      timestamp: Date.now() + 60_000,
      won: false,
      opponentName: "Clever Fox",
      roomId: "room-9",
      gameNumber: 1,
    });

    render(<Stats onBack={vi.fn()} />);

    const section = screen.getByRole("region", { name: /history/i });
    const rows = within(section).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(
      within(rows[0] as HTMLElement).getByText(/clever fox/i),
    ).toBeTruthy();
    expect(within(rows[1] as HTMLElement).getByText(/^solo$/i)).toBeTruthy();
  });
});
