import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RoomState } from "../lib/types.ts";
import { Lobby } from "./Lobby.tsx";
vi.mock("../lib/product-events.ts", () => ({ trackProductEvent: vi.fn() }));
import { trackProductEvent } from "../lib/product-events.ts";

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
  solution: null,
  winnerId: null,
  winnerName: null,
  winnerBoard: null,
  gameNumber: 0,
};

describe("Lobby", () => {
  it("shows that our ready action is waiting for the other player", () => {
    const state: RoomState = {
      ...BASE_STATE,
      readyPlayers: ["p1"],
      players: [
        ...BASE_STATE.players,
        { ...BASE_STATE.players[0]!, id: "p2", name: "Bob" },
      ],
    };
    render(
      <Lobby
        roomState={state}
        playerId="p1"
        onStart={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Ready — waiting for friend" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "Both players agree to the rules, then the same three-second countdown begins.",
      ),
    ).toBeInTheDocument();
  });
  it("shows room code and waiting message with one player", () => {
    render(<Lobby roomState={BASE_STATE} onStart={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText(/abc123/i)).toBeInTheDocument();
    expect(screen.getByText(/waiting/i)).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
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

  it("keeps start enabled when an overflow merge briefly leaves three entries", () => {
    // A concurrent-join race can merge to 3 players until the overflow
    // client evicts itself. The two seated players must still be able
    // to start — === 2 would brick the lobby if the eviction never
    // arrives (overflow player closed the tab).
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
        {
          id: "p3",
          name: "Carol",
          color: "#10B981",
          cellsRemaining: 81,
          completionPercent: 0,
        },
      ],
    };

    render(<Lobby roomState={state} onStart={vi.fn()} onBack={vi.fn()} />);

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
    expect(trackProductEvent).toHaveBeenCalledWith("invite_share", "live");
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
