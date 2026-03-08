import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GameResult } from "./GameResult.tsx";

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

  it("shows personal best when timeSeconds and difficulty provided", () => {
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(
      JSON.stringify([
        { difficulty: "medium", time: 300, date: "2026-01-01", won: true },
        { difficulty: "medium", time: 250, date: "2026-01-02", won: true },
      ]),
    );

    render(
      <GameResult
        isWinner={true}
        time="04:00"
        timeSeconds={240}
        difficulty="medium"
        onNewGame={vi.fn()}
      />,
    );

    // Should show best time from stats (250s = 04:10)
    expect(screen.getByText(/best/i)).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it("shows New Best indicator when current time beats record", () => {
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(
      JSON.stringify([
        { difficulty: "easy", time: 300, date: "2026-01-01", won: true },
      ]),
    );

    render(
      <GameResult
        isWinner={true}
        time="02:00"
        timeSeconds={120}
        difficulty="easy"
        onNewGame={vi.fn()}
      />,
    );

    expect(screen.getByText(/new best/i)).toBeInTheDocument();

    vi.restoreAllMocks();
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
