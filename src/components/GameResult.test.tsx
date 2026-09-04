import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { buildShareText, GameResult } from "./GameResult.tsx";

describe("GameResult", () => {
  it("renders win state with time and emoji", () => {
    render(<GameResult isWinner={true} time="03:42" onNewGame={vi.fn()} />);

    expect(screen.getByText("You Won!")).toBeInTheDocument();
    expect(screen.getByText("03:42")).toBeInTheDocument();
    expect(screen.getByText("🎉")).toBeInTheDocument();
  });

  it("renders completion state for non-winner", () => {
    render(<GameResult isWinner={false} time="05:00" onNewGame={vi.fn()} />);

    expect(screen.getByText("Puzzle Complete!")).toBeInTheDocument();
    expect(screen.getByText("👏")).toBeInTheDocument();
  });

  it("displays difficulty label when provided", () => {
    render(
      <GameResult
        isWinner={true}
        time="03:42"
        difficulty="hard"
        onNewGame={vi.fn()}
      />,
    );

    expect(screen.getByText("Hard")).toBeInTheDocument();
  });

  it("announces as a modal dialog labelled by the outcome", () => {
    // Without dialog semantics a screen-reader user who finishes the
    // puzzle hears nothing, and Tab keeps cycling the covered board.
    render(<GameResult isWinner={true} time="03:42" onNewGame={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName(/you won/i);
  });

  it("moves focus onto the primary action when it opens", () => {
    render(
      <GameResult
        isWinner={true}
        time="03:42"
        onRematch={vi.fn()}
        onNewGame={vi.fn()}
      />,
    );
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /another puzzle/i }),
    );
  });

  it("only shows Copied! after the clipboard write succeeds", async () => {
    // navigator.clipboard.writeText returns a promise that rejects on
    // iOS when transient activation is lost; flipping the label before
    // it settles claims a copy that never happened (and the rejection
    // was unhandled).
    let resolveWrite: () => void = () => {};
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockReturnValue(
          new Promise<void>((resolve) => {
            resolveWrite = resolve;
          }),
        ),
      },
    });
    render(<GameResult isWinner={true} time="03:42" onNewGame={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /share/i }));
    expect(screen.queryByText("Copied!")).not.toBeInTheDocument();

    resolveWrite();
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
  });

  it("does not claim Copied! when the clipboard write fails", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      },
    });
    render(<GameResult isWinner={true} time="03:42" onNewGame={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /share/i }));

    expect(screen.queryByText("Copied!")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
  });

  it("shows stats grid when stats prop provided", () => {
    render(
      <GameResult
        isWinner={true}
        time="04:00"
        difficulty="medium"
        onNewGame={vi.fn()}
        stats={{ gamesPlayed: 2, bestTime: 250, averageTime: 275 }}
      />,
    );

    expect(screen.getByText("Played")).toBeInTheDocument();
    expect(screen.getByText("Best")).toBeInTheDocument();
    expect(screen.getByText("Average")).toBeInTheDocument();
  });

  it("shows New Personal Best indicator when isNewPB is true", () => {
    render(
      <GameResult
        isWinner={true}
        time="02:00"
        difficulty="easy"
        onNewGame={vi.fn()}
        isNewPB={true}
      />,
    );

    expect(screen.getByText(/new personal best/i)).toBeInTheDocument();
  });

  it("shows Another puzzle in solo mode and Rematch in multiplayer", () => {
    const { rerender } = render(
      <GameResult
        isWinner={true}
        time="03:00"
        onRematch={vi.fn()}
        onNewGame={vi.fn()}
      />,
    );

    expect(screen.getByText("Another puzzle")).toBeInTheDocument();

    rerender(
      <GameResult
        isWinner={true}
        time="03:00"
        isMultiplayer={true}
        onRematch={vi.fn()}
        onNewGame={vi.fn()}
      />,
    );

    expect(screen.getByText("Rematch")).toBeInTheDocument();
  });

  it("share text includes difficulty, time, and URL", () => {
    const text = buildShareText({ difficulty: "hard", time: "03:42" });
    expect(text).toBe("Dokuel Hard\n⏱ 03:42\nhttps://dokuel.com");
  });

  it("share text includes PB indicator", () => {
    const text = buildShareText({
      difficulty: "easy",
      time: "02:00",
      isNewPB: true,
    });
    expect(text).toContain("⚡");
  });

  it("share text includes hints count", () => {
    const text = buildShareText({
      difficulty: "medium",
      time: "04:00",
      hintsUsed: 2,
    });
    expect(text).toContain("2 hints");
  });

  it("share text includes daily title and streak", () => {
    const text = buildShareText({
      difficulty: "medium",
      time: "05:00",
      isDaily: true,
      streakInfo: { currentStreak: 5, longestStreak: 10 },
    });
    expect(text).toMatch(/^Dokuel Daily/);
    expect(text).toContain("🔥 5-day streak");
  });

  it("calls onRematch and onNewGame when buttons clicked", async () => {
    const onRematch = vi.fn();
    const onNewGame = vi.fn();

    render(
      <GameResult
        isWinner={true}
        time="03:00"
        onRematch={onRematch}
        onNewGame={onNewGame}
      />,
    );

    await userEvent.click(screen.getByText("Another puzzle"));
    expect(onRematch).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByText("Back to home"));
    expect(onNewGame).toHaveBeenCalledOnce();
  });
});
