import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { MatchResult } from "./MatchResult.tsx";

type Props = ComponentProps<typeof MatchResult>;

function renderResult(
  overrides: Partial<Omit<Props, "next">> & Partial<Props["next"]>,
) {
  const {
    rematch = "idle",
    difficulty: nextDifficulty = "medium",
    onDifficultyChange,
    onRematch = vi.fn(),
    ...rest
  } = overrides;
  const props: Props = {
    won: true,
    opponentName: "Bob",
    time: "04:12",
    progressPercent: 100,
    difficulty: "medium",
    score: { wins: 1, losses: 0 },
    opponentAway: false,
    onLeave: vi.fn(),
    ...rest,
    next: {
      rematch,
      difficulty: nextDifficulty,
      onDifficultyChange,
      onRematch,
    },
  };
  render(<MatchResult {...props} />);
  return { ...props, onRematch };
}

describe("MatchResult", () => {
  it("shows the winner their time and the running score", () => {
    renderResult({ score: { wins: 2, losses: 1 } });

    expect(screen.getByRole("dialog")).toHaveAccessibleName(/you won/i);
    expect(screen.getByText("04:12")).toBeInTheDocument();
    expect(screen.getByLabelText("Score")).toHaveTextContent("2–1");
  });

  it("lets a player who lost mid-board keep solving", async () => {
    // Being forced to finish a lost board before anything else was on
    // offer is exactly what made the next game tedious to reach.
    const onKeepSolving = vi.fn();
    renderResult({
      won: false,
      time: null,
      progressPercent: 64,
      onKeepSolving,
    });

    expect(screen.getByRole("dialog")).toHaveAccessibleName(/bob won/i);
    expect(screen.getByText("64%")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /keep solving/i }),
    );
    expect(onKeepSolving).toHaveBeenCalledOnce();
  });

  it("asks for a rematch with the primary action", async () => {
    const props = renderResult({});

    const button = screen.getByRole("button", { name: "Rematch" });
    expect(document.activeElement).toBe(button);
    await userEvent.click(button);
    expect(props.onRematch).toHaveBeenCalledOnce();
  });

  it("shows we are waiting once we asked", () => {
    renderResult({ rematch: "waiting" });

    expect(
      screen.getByRole("button", { name: /waiting for bob/i }),
    ).toBeDisabled();
  });

  it("says when the opponent seems gone while we wait", () => {
    renderResult({ rematch: "waiting", opponentAway: true });

    expect(screen.getByText(/bob seems to have left/i)).toBeInTheDocument();
  });

  it("invites us to accept the opponent's rematch", async () => {
    const props = renderResult({ rematch: "invited" });

    expect(screen.getByText(/bob wants a rematch/i)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /accept rematch/i }),
    );
    expect(props.onRematch).toHaveBeenCalledOnce();
  });

  it("lets the host pick the next game's difficulty", async () => {
    const onNextDifficultyChange = vi.fn();
    renderResult({ onDifficultyChange: onNextDifficultyChange });

    await userEvent.click(screen.getByRole("radio", { name: /hard/i }));
    expect(onNextDifficultyChange).toHaveBeenCalledWith("hard");
  });

  it("shows the guest which difficulty comes next", () => {
    renderResult({ difficulty: "expert" });

    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.getByText(/next game/i)).toHaveTextContent(/expert/i);
  });

  it("leaves the room", async () => {
    const props = renderResult({});

    await userEvent.click(screen.getByRole("button", { name: /leave/i }));
    expect(props.onLeave).toHaveBeenCalledOnce();
  });
});
