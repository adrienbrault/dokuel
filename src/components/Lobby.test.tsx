import { describe, expect, it, jest } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Friend } from "../lib/friends.ts";
import type { RoomState } from "../lib/types.ts";
import { Lobby } from "./Lobby.tsx";

function makeFriend(playerId: string, name: string): Friend {
  return { playerId, name, addedAt: new Date().toISOString() };
}

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
  events: [],
};

describe("Lobby", () => {
  it("shows room code and waiting message with one player", () => {
    render(
      <Lobby roomState={BASE_STATE} onStart={jest.fn()} onBack={jest.fn()} />,
    );

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

    const onStart = jest.fn();
    render(<Lobby roomState={state} onStart={onStart} onBack={jest.fn()} />);

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

    const onStart = jest.fn();
    render(<Lobby roomState={state} onStart={onStart} onBack={jest.fn()} />);

    const startBtn = screen.getByRole("button", { name: /start/i });
    expect(startBtn).not.toBeDisabled();
  });

  it("copies game link to clipboard when share button clicked", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
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

    render(
      <Lobby roomState={BASE_STATE} onStart={jest.fn()} onBack={jest.fn()} />,
    );

    const shareBtn = screen.getByRole("button", { name: /share|copy|invite/i });
    await userEvent.click(shareBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://dokuel.com/abc123",
    );
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

    const onStart = jest.fn();
    render(<Lobby roomState={state} onStart={onStart} onBack={jest.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /start/i }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("shows invite buttons for friends when waiting for opponent", () => {
    const friends = [
      makeFriend("friend1", "Bold Lion"),
      makeFriend("friend2", "Clever Fox"),
    ];
    const onInviteFriend = jest.fn();

    render(
      <Lobby
        roomState={BASE_STATE}
        onStart={jest.fn()}
        onBack={jest.fn()}
        friends={friends}
        onInviteFriend={onInviteFriend}
      />,
    );

    expect(screen.getByText("Bold Lion")).toBeInTheDocument();
    expect(screen.getByText("Clever Fox")).toBeInTheDocument();
    expect(screen.getByLabelText("Invite Bold Lion")).toBeInTheDocument();
  });

  it("calls onInviteFriend when lobby invite button clicked", async () => {
    const friends = [makeFriend("friend1", "Bold Lion")];
    const onInviteFriend = jest.fn();

    render(
      <Lobby
        roomState={BASE_STATE}
        onStart={jest.fn()}
        onBack={jest.fn()}
        friends={friends}
        onInviteFriend={onInviteFriend}
      />,
    );

    await userEvent.click(screen.getByLabelText("Invite Bold Lion"));
    expect(onInviteFriend).toHaveBeenCalledWith("friend1");
  });

  it("hides friend invite section when opponent already joined", () => {
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
    const friends = [makeFriend("friend1", "Bold Lion")];

    render(
      <Lobby
        roomState={state}
        onStart={jest.fn()}
        onBack={jest.fn()}
        friends={friends}
        onInviteFriend={jest.fn()}
      />,
    );

    expect(screen.queryByLabelText("Invite Bold Lion")).not.toBeInTheDocument();
  });
});
