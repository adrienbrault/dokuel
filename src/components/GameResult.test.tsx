import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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
      screen.getByRole("button", { name: /play again/i }),
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

  it("shows Play Again in solo mode and Rematch in multiplayer", () => {
    const { rerender } = render(
      <GameResult
        isWinner={true}
        time="03:00"
        onRematch={vi.fn()}
        onNewGame={vi.fn()}
      />,
    );

    expect(screen.getByText("Play Again")).toBeInTheDocument();

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

  it("share text points an archived daily at its own date", () => {
    // Sharing an archive run with the bare site link would send
    // friends to today's puzzle instead of the one just played.
    const text = buildShareText({
      difficulty: "medium",
      time: "06:10",
      isDaily: true,
      archiveDate: "2026-05-16",
    });

    expect(text).toContain("May 16");
    expect(text).toContain("https://dokuel.com/daily/2026-05-16");
  });

  it("offers the caller's extra link under the share action", async () => {
    const onClick = vi.fn();
    render(
      <GameResult
        isWinner={true}
        time="04:00"
        onNewGame={vi.fn()}
        footerLink={{ label: "Past dailies", onClick }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Past dailies" }));

    expect(onClick).toHaveBeenCalledOnce();
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

    await userEvent.click(screen.getByText("Play Again"));
    expect(onRematch).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByText("New Game"));
    expect(onNewGame).toHaveBeenCalledOnce();
  });
});

describe("GameResult challenge link", () => {
  const CHALLENGE_URL = "https://dokuel.com/solo/medium/abc123?t=252&by=Ann";

  afterEach(() => {
    Reflect.deleteProperty(navigator, "share");
  });

  it("offers no challenge action without a link", () => {
    render(<GameResult isWinner={true} time="03:42" onNewGame={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: /challenge a friend/i }),
    ).not.toBeInTheDocument();
  });

  it("hands the link to the native share sheet when there is one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });

    render(
      <GameResult
        isWinner={true}
        time="04:12"
        difficulty="medium"
        challengeUrl={CHALLENGE_URL}
        onNewGame={vi.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /challenge a friend/i }),
    );

    expect(share).toHaveBeenCalledWith({
      text: `I solved this Medium sudoku in 04:12. Beat my time!\n${CHALLENGE_URL}`,
    });
  });

  it("copies the link and confirms only once the write lands", async () => {
    Reflect.deleteProperty(navigator, "share");
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

    render(
      <GameResult
        isWinner={true}
        time="04:12"
        difficulty="medium"
        challengeUrl={CHALLENGE_URL}
        onNewGame={vi.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /challenge a friend/i }),
    );
    expect(screen.queryByText("Copied!")).not.toBeInTheDocument();

    resolveWrite();
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining(CHALLENGE_URL),
    );
  });
});

describe("GameResult challenge comparison", () => {
  it("leads with the comparison when the player wins the race", () => {
    render(
      <GameResult
        isWinner={true}
        time="03:25"
        timeSeconds={205}
        difficulty="medium"
        challenge={{ time: 252, by: "Swift Panda" }}
        onNewGame={vi.fn()}
      />,
    );

    expect(
      screen.getByText("You beat Swift Panda's 04:12!"),
    ).toBeInTheDocument();
    expect(screen.getByText("00:47 faster")).toBeInTheDocument();
  });

  it("says who was faster when the challenge stands", () => {
    render(
      <GameResult
        isWinner={true}
        time="05:00"
        timeSeconds={300}
        difficulty="medium"
        challenge={{ time: 252, by: "Swift Panda" }}
        onNewGame={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Swift Panda was faster: 04:12"),
    ).toBeInTheDocument();
    expect(screen.getByText("00:48 behind")).toBeInTheDocument();
  });
});
