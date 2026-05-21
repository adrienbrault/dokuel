import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeChallenge } from "../lib/challenge.ts";
import type { Challenge } from "../lib/types.ts";
import { ChallengeScreen } from "./ChallengeScreen.tsx";

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
    { t: 200, p: 100 },
  ],
};

afterEach(() => {
  localStorage.clear();
  window.history.pushState({}, "", "/");
});

describe("ChallengeScreen", () => {
  it("decodes a valid challenge link and starts the game", async () => {
    const blob = await encodeChallenge(challenge);
    window.history.pushState({}, "", `/challenge#${blob}`);

    render(<ChallengeScreen onBack={vi.fn()} />);

    expect(
      await screen.findByText("Challenge from clever-otter"),
    ).toBeInTheDocument();
  });

  it("shows a friendly error for an undecodable challenge link", async () => {
    window.history.pushState({}, "", "/challenge#not-a-real-blob");

    render(<ChallengeScreen onBack={vi.fn()} />);

    expect(
      await screen.findByText("Challenge unavailable"),
    ).toBeInTheDocument();
  });
});
