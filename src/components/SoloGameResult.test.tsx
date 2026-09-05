import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GameCompletionResult } from "../lib/game-completion.ts";
import { SoloGameResult } from "./SoloGameResult.tsx";

vi.mock("./GameResult.tsx", () => ({
  GameResult: (props: {
    time: string;
    timeSeconds?: number;
    shareReceipt?: { friend: { timeSeconds: number } };
  }) => (
    <output
      data-testid="mock-game-result"
      data-time={props.time}
      data-seconds={props.timeSeconds}
      data-receipt-time={props.shareReceipt?.friend.timeSeconds}
    />
  ),
}));

const completion: GameCompletionResult = {
  stats: null,
  isNewPB: false,
  assistLevel: "standard",
  timeSeconds: 17,
};

describe("SoloGameResult", () => {
  it("displays the persisted completion time used by shared results", () => {
    render(
      <SoloGameResult
        elapsedSeconds={18.9}
        difficulty="easy"
        puzzle={".".repeat(81)}
        completion={completion}
        hintsUsed={0}
        isDaily={false}
        tipDismissed
        position="bottom"
        onNewGame={vi.fn()}
        onDismissTip={vi.fn()}
      />,
    );

    const result = screen.getByTestId("mock-game-result");
    expect(result).toHaveAttribute("data-time", "00:17");
    expect(result).toHaveAttribute("data-seconds", "17");
  });

  it("uses the persisted whole second in the comparison receipt", () => {
    render(
      <SoloGameResult
        elapsedSeconds={18.9}
        difficulty="easy"
        puzzle={
          ".34678912672195348198342567859761423426853791713924856961537284287419635345286179"
        }
        challenge={{
          version: 1,
          puzzle:
            ".34678912672195348198342567859761423426853791713924856961537284287419635345286179",
          difficulty: "easy",
          assistLevel: "standard",
          timeSeconds: 20,
          hintsUsed: 0,
        }}
        gameKey="friend-result"
        completion={completion}
        hintsUsed={0}
        isDaily={false}
        tipDismissed
        position="bottom"
        onNewGame={vi.fn()}
        onDismissTip={vi.fn()}
      />,
    );

    expect(screen.getByTestId("mock-game-result")).toHaveAttribute(
      "data-receipt-time",
      "17",
    );
  });
});
