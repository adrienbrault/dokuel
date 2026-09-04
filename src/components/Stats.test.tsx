import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveMultiplayerGameResult } from "../lib/multiplayer-stats.ts";
import { saveGameResult } from "../lib/stats.ts";
import { Stats } from "./Stats.tsx";

describe("Stats page — solo section", () => {
  it("shows lifetime totals after recent records are evicted", () => {
    localStorage.clear();
    for (let index = 0; index < 101; index++)
      saveGameResult("easy", "standard", 60, true);
    render(<Stats onBack={vi.fn()} />);
    expect(screen.getByText("101 games played")).toBeInTheDocument();
  });
  it("lets players inspect friend results separately from fresh puzzles", () => {
    localStorage.clear();
    saveGameResult({
      difficulty: "easy",
      assistLevel: "standard",
      time: 300,
      won: true,
      origin: "generated",
    });
    saveGameResult({
      difficulty: "easy",
      assistLevel: "standard",
      time: 60,
      won: true,
      origin: "friend",
    });
    render(<Stats onBack={vi.fn()} />);
    const section = screen.getByRole("region", { name: "Solo" });
    expect(within(section).queryByText("01:00")).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Puzzle source" }), {
      target: { value: "friend" },
    });
    expect(within(section).getAllByText("01:00").length).toBeGreaterThan(0);
    expect(within(section).queryByText("05:00")).toBeNull();
  });
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

    const section = screen.getByRole("region", { name: "Solo", exact: true });
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

    const section = screen.getByRole("region", { name: "Solo", exact: true });
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
