import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Challenge } from "../lib/types.ts";
import { ChallengeGame } from "./ChallengeGame.tsx";

const challenge: Challenge = {
  v: 1,
  puzzle:
    "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79",
  difficulty: "medium",
  assistLevel: "standard",
  challengerName: "clever-otter",
  finalTime: 200,
  hintsUsed: 0,
  ghost: [
    { t: 0, p: 0 },
    { t: 100, p: 50 },
    { t: 200, p: 100 },
  ],
};

afterEach(() => {
  localStorage.clear();
});

describe("ChallengeGame", () => {
  it("shows who set the challenge", () => {
    render(<ChallengeGame challenge={challenge} onBack={vi.fn()} />);
    expect(screen.getByText("Challenge from clever-otter")).toBeInTheDocument();
  });

  it("races a ghost progress bar labelled with the challenger's name", () => {
    render(<ChallengeGame challenge={challenge} onBack={vi.fn()} />);
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("clever-otter")).toBeInTheDocument();
  });
});
