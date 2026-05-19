import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveMultiplayerGameResult } from "../lib/multiplayer-stats.ts";
import { Stats } from "./Stats.tsx";

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

  it("lists recent matches with opponent name, time, and outcome", () => {
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

    const section = screen.getByRole("region", { name: /multiplayer/i });
    const list = within(section).getByRole("list");
    const row = within(list).getByRole("listitem");
    expect(within(row).getByText(/brave otter/i)).toBeTruthy();
    expect(within(row).getByText("04:05")).toBeTruthy();
    expect(within(row).getByText(/won/i)).toBeTruthy();
  });
});
