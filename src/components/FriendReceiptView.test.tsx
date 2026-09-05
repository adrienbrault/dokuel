import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FriendReceipt } from "../lib/friend-receipt.ts";
import { readRivalryHistory } from "../lib/rivalry.ts";
import { FriendReceiptView } from "./FriendReceiptView.tsx";

const receipt: FriendReceipt = {
  version: 1,
  matchId: "match-view-1",
  challenge: {
    version: 1,
    puzzle:
      ".34678912672195348198342567859761423426853791713924856961537284287419635345286179",
    difficulty: "easy",
    assistLevel: "standard",
    timeSeconds: 222,
    hintsUsed: 0,
  },
  challenger: {
    name: "Adrien",
    timeSeconds: 222,
    assistLevel: "standard",
    hintsUsed: 0,
  },
  friend: {
    name: "Luna",
    timeSeconds: 180,
    assistLevel: "standard",
    hintsUsed: 0,
  },
  series: {
    id: "series-1",
    gameNumber: 1,
    challengerWins: 0,
    friendWins: 1,
  },
};

describe("FriendReceiptView", () => {
  beforeEach(() => localStorage.clear());

  it("shows both times, the difference, series progress, and next actions", async () => {
    const onChallengeAgain = vi.fn();
    const onBestOfThree = vi.fn();
    const onLiveChallenge = vi.fn();
    render(
      <FriendReceiptView
        receipt={receipt}
        onBack={vi.fn()}
        onChallengeAgain={onChallengeAgain}
        onBestOfThree={onBestOfThree}
        onLiveChallenge={onLiveChallenge}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Race result" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Adrien")).toBeInTheDocument();
    expect(screen.getByText("Luna")).toBeInTheDocument();
    expect(screen.getByText("03:42")).toBeInTheDocument();
    expect(screen.getByText("03:00")).toBeInTheDocument();
    expect(screen.getByText(/Luna finished first/)).toBeInTheDocument();
    expect(screen.getByText(/00:42 faster/)).toBeInTheDocument();
    expect(screen.getByText(/Game 1 of 3/)).toBeInTheDocument();
    expect(
      screen.getByText(/Time challenge · asynchronous/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Play live instead" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Challenge again" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("radio", { name: "I am Luna" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "I am Luna" }));

    await userEvent.click(
      screen.getByRole("button", { name: "Challenge again" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Continue best of 3" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Play live instead" }),
    );
    expect(onChallengeAgain).toHaveBeenCalledOnce();
    expect(onChallengeAgain).toHaveBeenCalledWith("friend");
    expect(onBestOfThree).toHaveBeenCalledOnce();
    expect(onBestOfThree).toHaveBeenCalledWith("friend");
    expect(onLiveChallenge).toHaveBeenCalledOnce();
    expect(readRivalryHistory()).toHaveLength(1);
  });

  it("hides competitive continuation after a terminal or practice result", () => {
    const series = receipt.series;
    if (!series) throw new Error("fixture must include a series");
    const { rerender } = render(
      <FriendReceiptView
        receipt={{
          ...receipt,
          series: { ...series, challengerWins: 2, friendWins: 0 },
        }}
        onBack={vi.fn()}
        onBestOfThree={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /continue best of 3/i }),
    ).not.toBeInTheDocument();

    rerender(
      <FriendReceiptView
        receipt={{
          ...receipt,
          series: undefined,
          friend: { ...receipt.friend, hintsUsed: 1 },
        }}
        onBack={vi.fn()}
        onBestOfThree={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /start best of 3/i }),
    ).not.toBeInTheDocument();
  });
});
