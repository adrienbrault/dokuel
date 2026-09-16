import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveGame } from "../lib/game-storage.ts";
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
  });

  it("keeps the menu short, folding older games behind a toggle", async () => {
    for (const key of ["a", "b", "c", "d", "e"]) saveInProgressGame(key);

    renderLanding();

    expect(screen.getAllByText("Continue")).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: /2 more/i }));
    expect(screen.getAllByText("Continue")).toHaveLength(5);
  });
});
