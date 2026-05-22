import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MultiplayerHeaderExtra } from "./MultiplayerHeaderExtra.tsx";

describe("MultiplayerHeaderExtra", () => {
  it("labels the opponent bar 'Opponent' by default", () => {
    render(
      <MultiplayerHeaderExtra
        gameOver={null}
        iFinished={false}
        showOpponentProgress
        opponentProgress={{ completionPercent: 40 }}
        opponentDisconnected={false}
        myPercent={20}
      />,
    );

    expect(screen.getByText("Opponent")).toBeInTheDocument();
  });

  it("uses a custom opponent label when provided", () => {
    render(
      <MultiplayerHeaderExtra
        gameOver={null}
        iFinished={false}
        showOpponentProgress
        opponentProgress={{ completionPercent: 40 }}
        opponentDisconnected={false}
        myPercent={20}
        opponentLabel="clever-otter"
      />,
    );

    expect(screen.getByText("clever-otter")).toBeInTheDocument();
    expect(screen.queryByText("Opponent")).not.toBeInTheDocument();
  });
});
