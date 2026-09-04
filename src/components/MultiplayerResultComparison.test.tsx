import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MultiplayerResultComparison } from "./MultiplayerResultComparison.tsx";

const SOLUTION = "1".repeat(81);

describe("MultiplayerResultComparison", () => {
  it("shows both finish times and identifies the second finisher", () => {
    render(
      <MultiplayerResultComparison
        playerId="p1"
        opponentName="Brave Otter"
        startedAt={10_000}
        results={{
          p1: { completedAt: 12_000, board: SOLUTION },
          p2: { completedAt: 17_000, board: SOLUTION },
        }}
      />,
    );

    expect(
      screen.getByRole("region", { name: /race results/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Brave Otter")).toBeInTheDocument();
    expect(screen.getByText("00:02")).toBeInTheDocument();
    expect(screen.getByText("00:07")).toBeInTheDocument();
    expect(
      screen.getByText(/You finished 00:05 ahead of Brave Otter/),
    ).toBeInTheDocument();
    expect(screen.getByText("Finished first")).toBeInTheDocument();
    expect(screen.getByText("Finished second")).toBeInTheDocument();
  });

  it("keeps the first result visible while the other player is still solving", () => {
    render(
      <MultiplayerResultComparison
        playerId="p1"
        opponentName="Brave Otter"
        startedAt={10_000}
        results={{
          p1: { completedAt: 12_000, board: SOLUTION },
        }}
      />,
    );

    expect(screen.getByText("00:02")).toBeInTheDocument();
    expect(screen.getByRole("status").textContent).toMatch(
      /waiting for Brave Otter to finish/i,
    );
    expect(screen.queryByText("Finished second")).not.toBeInTheDocument();
  });
});
