import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RoomState } from "../lib/types.ts";
import { Lobby } from "./Lobby.tsx";

const BASE_STATE: RoomState = {
  roomId: "abc123",
  status: "lobby",
  difficulty: "medium",
  assistLevel: "standard",
  hostId: "p1",
  players: [
    {
      id: "p1",
      name: "Alice",
      color: "#3B82F6",

      cellsRemaining: 81,
      completionPercent: 0,
    },
  ],
  puzzle: null,
  winnerId: null,
  winnerName: null,
  gameNumber: 0,
  events: [],
};

describe("Lobby", () => {
  it("shows room code and waiting message with one player", () => {
    render(<Lobby roomState={BASE_STATE} onStart={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText(/abc123/i)).toBeInTheDocument();
    expect(screen.getByText(/waiting/i)).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("offers an async-challenge fallback while waiting for an opponent", async () => {
    const onPlayAsync = vi.fn();
    render(
      <Lobby
        roomState={BASE_STATE}
        onStart={vi.fn()}
        onBack={vi.fn()}
        onPlayAsync={onPlayAsync}
      />,
    );

    await userEvent.click(screen.getByText("Play async instead"));
    expect(onPlayAsync).toHaveBeenCalledWith("medium", "standard");
  });

  it("hides the async fallback once a second player has joined", () => {
    const state: RoomState = {
      ...BASE_STATE,
      players: [
        ...BASE_STATE.players,
        {
          id: "p2",
          name: "Bob",
          color: "#EF4444",
          cellsRemaining: 81,
          completionPercent: 0,
        },
      ],
    };
    render(
      <Lobby
        roomState={state}
        onStart={vi.fn()}
        onBack={vi.fn()}
        onPlayAsync={vi.fn()}
      />,
    );

    expect(screen.queryByText("Play async instead")).not.toBeInTheDocument();
  });

  it("shows start button enabled when two players and user is host", () => {
    const state: RoomState = {
      ...BASE_STATE,
      players: [
        ...BASE_STATE.players,
        {
          id: "p2",
          name: "Bob",
          color: "#EF4444",

          cellsRemaining: 81,
          completionPercent: 0,
        },
      ],
    };

    const onStart = vi.fn();
    render(<Lobby roomState={state} onStart={onStart} onBack={vi.fn()} />);

    const startBtn = screen.getByRole("button", { name: /start/i });
    expect(startBtn).not.toBeDisabled();
  });

  it("shows start button enabled for non-host when two players present", () => {
    const state: RoomState = {
      ...BASE_STATE,
      players: [
        ...BASE_STATE.players,
        {
          id: "p2",
          name: "Bob",
          color: "#EF4444",

          cellsRemaining: 81,
          completionPercent: 0,
        },
      ],
    };

    const onStart = vi.fn();
    render(<Lobby roomState={state} onStart={onStart} onBack={vi.fn()} />);

    const startBtn = screen.getByRole("button", { name: /start/i });
    expect(startBtn).not.toBeDisabled();
  });

  it("copies game link to clipboard when share button clicked", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    // Ensure Web Share API is not available so clipboard fallback is used
    Object.defineProperty(navigator, "share", {
      value: undefined,
      writable: true,
    });
    Object.defineProperty(window, "location", {
      value: { origin: "https://dokuel.com", pathname: "/abc123" },
      writable: true,
    });

    render(<Lobby roomState={BASE_STATE} onStart={vi.fn()} onBack={vi.fn()} />);

    const shareBtn = screen.getByRole("button", { name: /share|copy|invite/i });
    await userEvent.click(shareBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://dokuel.com/abc123",
    );
  });

  it("displays the room difficulty so joiners see it", () => {
    const state: RoomState = { ...BASE_STATE, difficulty: "expert" };
    render(<Lobby roomState={state} onStart={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText(/expert/i)).toBeInTheDocument();
  });

  it("lets the host change difficulty via picker", async () => {
    const onDifficultyChange = vi.fn();
    render(
      <Lobby
        roomState={BASE_STATE}
        playerId="p1"
        onDifficultyChange={onDifficultyChange}
        onStart={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("radio", { name: /hard/i }));
    expect(onDifficultyChange).toHaveBeenCalledWith("hard");
  });

  it("does not show the difficulty picker to joiners", () => {
    render(
      <Lobby
        roomState={BASE_STATE}
        playerId="p2"
        onDifficultyChange={vi.fn()}
        onStart={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("radio", { name: /hard/i }),
    ).not.toBeInTheDocument();
  });

  it("calls onStart when start button clicked", async () => {
    const state: RoomState = {
      ...BASE_STATE,
      players: [
        ...BASE_STATE.players,
        {
          id: "p2",
          name: "Bob",
          color: "#EF4444",

          cellsRemaining: 81,
          completionPercent: 0,
        },
      ],
    };

    const onStart = vi.fn();
    render(<Lobby roomState={state} onStart={onStart} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /start/i }));
    expect(onStart).toHaveBeenCalledOnce();
  });
});
