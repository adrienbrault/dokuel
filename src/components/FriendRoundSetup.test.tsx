import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FriendRoundSetup } from "./FriendRoundSetup.tsx";
import type { SoloGame as SoloGameType } from "./SoloGame.tsx";

vi.mock("./SoloGame.tsx", () => ({
  SoloGame: (props: Parameters<typeof SoloGameType>[0]) => (
    <div
      data-testid="solo-game"
      data-puzzle={props.initialPuzzle}
      data-round={JSON.stringify(props.friendRound)}
    >
      <h2>{props.title}</h2>
    </div>
  ),
}));

const receipt = {
  version: 1 as const,
  matchId: "setup-1",
  challenge: {
    version: 1 as const,
    puzzle:
      ".34678912672195348198342567859761423426853791713924856961537284287419635345286179",
    difficulty: "easy" as const,
    assistLevel: "standard" as const,
    timeSeconds: 222,
    hintsUsed: 0,
  },
  challenger: {
    name: "Adrien",
    timeSeconds: 222,
    assistLevel: "standard" as const,
    hintsUsed: 0,
  },
  friend: {
    name: "Luna",
    timeSeconds: 180,
    assistLevel: "standard" as const,
    hintsUsed: 0,
  },
  series: {
    id: "series-1",
    gameNumber: 2 as const,
    challengerWins: 1 as const,
    friendWins: 0 as const,
  },
};

describe("FriendRoundSetup", () => {
  it("gives the selected player a fresh board to set the next target", () => {
    render(
      <FriendRoundSetup
        receipt={receipt}
        side="friend"
        mode="bestOfThree"
        onBack={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /Set next round target/i }),
    ).toBeInTheDocument();
    const game = screen.getByTestId("solo-game");
    expect(game.getAttribute("data-puzzle")).toMatch(/^[1-9.]{81}$/);
    expect(game.getAttribute("data-puzzle")).not.toBe(receipt.challenge.puzzle);
    expect(JSON.parse(game.getAttribute("data-round") ?? "{}")).toMatchObject({
      side: "friend",
      mode: "bestOfThree",
      series: {
        id: "series-1",
        gameNumber: 3,
        challengerWins: 1,
        friendWins: 0,
      },
    });
  });
});
