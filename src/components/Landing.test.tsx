import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { saveGame } from "../lib/game-storage.ts";
import { Landing } from "./Landing.tsx";

beforeEach(() => localStorage.clear());

it("offers an unfinished past daily with its original date", () => {
  saveGame("daily-2025-01-02-medium", {
    puzzle: `123${".".repeat(78)}`,
    values: `1234${".".repeat(77)}`,
    notes: Array.from({ length: 81 }, () => []),
    timer: 42,
    difficulty: "medium",
    assistLevel: "standard",
    hintsUsed: 0,
  });
  const onContinue = vi.fn();
  render(
    <Landing
      onContinue={onContinue}
      onSolo={vi.fn()}
      onDaily={vi.fn()}
      onCreate={vi.fn()}
      onJoin={vi.fn()}
      onStats={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Continue daily/ }));
  expect(onContinue).toHaveBeenCalledWith(
    expect.objectContaining({ dailyDate: "2025-01-02" }),
  );
});

it("offers a multiplayer save as a return to its room", () => {
  saveGame("mp_calm-lamb-g4bb_123.........", {
    puzzle: `123${".".repeat(78)}`,
    values: `123${".".repeat(78)}`,
    notes: Array.from({ length: 81 }, () => []),
    timer: 42,
    difficulty: "easy",
    assistLevel: "standard",
    hintsUsed: 0,
  });
  const onContinue = vi.fn();
  render(
    <Landing
      onContinue={onContinue}
      onSolo={vi.fn()}
      onDaily={vi.fn()}
      onCreate={vi.fn()}
      onJoin={vi.fn()}
      onStats={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Return to duel/ }));
  expect(onContinue).toHaveBeenCalledWith(
    expect.objectContaining({ roomId: "calm-lamb-g4bb" }),
  );
});
