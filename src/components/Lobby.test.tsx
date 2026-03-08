import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RoomState } from "../lib/types.ts";
import { Lobby } from "./Lobby.tsx";

const BASE_STATE: RoomState = {
  roomId: "abc123",
  status: "lobby",
  difficulty: "medium",
  hostId: "p1",
  players: [
    {
      id: "p1",
      name: "Alice",
      color: "#3B82F6",
      connected: true,
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
      <Lobby
        roomState={BASE_STATE}
        playerId="p1"
        onStart={vi.fn()}
        onBack={vi.fn()}
      />,
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
          connected: true,
          cellsRemaining: 81,
          completionPercent: 0,
        },
      ],
    };

    const onStart = vi.fn();
    render(
      <Lobby
        roomState={state}
        playerId="p1"
        onStart={onStart}
        onBack={vi.fn()}
      />,
    );

    const startBtn = screen.getByRole("button", { name: /start/i });
    expect(startBtn).not.toBeDisabled();
  });

  it("disables start button for non-host", () => {
    const state: RoomState = {
      ...BASE_STATE,
      players: [
        ...BASE_STATE.players,
        {
          id: "p2",
          name: "Bob",
          color: "#EF4444",
          connected: true,
          cellsRemaining: 81,
          completionPercent: 0,
        },
      ],
    };

    render(
      <Lobby
        roomState={state}
        playerId="p2"
        onStart={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const startBtn = screen.queryByRole("button", { name: /start/i });
    expect(startBtn).toBeNull();
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
          connected: true,
          cellsRemaining: 81,
          completionPercent: 0,
        },
      ],
    };

    const onStart = vi.fn();
    render(
      <Lobby
        roomState={state}
        playerId="p1"
        onStart={onStart}
        onBack={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /start/i }));
    expect(onStart).toHaveBeenCalledOnce();
  });
});
