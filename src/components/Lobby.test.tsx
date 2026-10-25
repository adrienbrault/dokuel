import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RoomState } from "../lib/types.ts";
import { Lobby } from "./Lobby.tsx";

const BASE_STATE: RoomState = {
  roomId: "abc123",
  status: "lobby",
  mode: "ffa",
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
      team: null,
      mistakes: 0,
    },
  ],
  puzzle: null,
  solution: null,
  winnerId: null,
  winnerName: null,
  winnerBoard: null,
  gameNumber: 0,
  digitStyle: null,
  rematchVotes: [],
};

describe("Lobby", () => {
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
          team: null,
          mistakes: 0,
        },
      ],
    };

    const onStart = vi.fn();
    render(<Lobby roomState={state} onStart={onStart} onBack={vi.fn()} />);

    const startBtn = screen.getByRole("button", { name: /start/i });
    expect(startBtn).not.toBeDisabled();
  });

  it("keeps start enabled for a three-player room", () => {
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
          team: null,
          mistakes: 0,
        },
        {
          id: "p3",
          name: "Carol",
          color: "#10B981",
          cellsRemaining: 81,
          completionPercent: 0,
          team: null,
          mistakes: 0,
        },
      ],
    };

    render(<Lobby roomState={state} onStart={vi.fn()} onBack={vi.fn()} />);

    const startBtn = screen.getByRole("button", { name: /start/i });
    expect(startBtn).not.toBeDisabled();
  });

  it("tells a two-player lobby that two more can still join", () => {
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
          team: null,
          mistakes: 0,
        },
      ],
    };

    render(<Lobby roomState={state} onStart={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText("Room for 2 more players")).toBeInTheDocument();
    expect(screen.queryByText(/waiting for opponent/i)).toBeNull();
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
          team: null,
          mistakes: 0,
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
          team: null,
          mistakes: 0,
        },
      ],
    };

    const onStart = vi.fn();
    render(<Lobby roomState={state} onStart={onStart} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /start/i }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("lets the host pin one digit style for both boards", async () => {
    // "Let's both play with the vehicles" is a lobby decision, so the
    // toggle seeds the room from what the host already plays with.
    localStorage.setItem("sudoku_digit_color_mode", "emoji");
    localStorage.setItem("sudoku_emoji_theme", "vehicles");
    const onDigitStyleChange = vi.fn();

    render(
      <Lobby
        roomState={BASE_STATE}
        playerId="p1"
        onDigitStyleChange={onDigitStyleChange}
        onStart={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("switch", { name: /same digits/i }));

    expect(onDigitStyleChange).toHaveBeenCalledWith({
      mode: "emoji",
      emojiTheme: "vehicles",
    });
  });
});

describe("Lobby teams", () => {
  it("lets the host pick race, co-op or 2v2", async () => {
    const onModeChange = vi.fn();
    render(
      <Lobby
        roomState={BASE_STATE}
        playerId="p1"
        onModeChange={onModeChange}
        onStart={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const mode = screen.getByRole("radiogroup", { name: "Mode" });

    await userEvent.click(within(mode).getByRole("radio", { name: /co-op/i }));
    expect(onModeChange).toHaveBeenLastCalledWith("coop");

    await userEvent.click(within(mode).getByRole("radio", { name: /2v2/i }));
    expect(onModeChange).toHaveBeenLastCalledWith("teams");
  });

  it("lets us pick our own team", async () => {
    const onTeamChange = vi.fn();
    render(
      <Lobby
        roomState={{ ...BASE_STATE, mode: "teams" }}
        playerId="p1"
        onTeamChange={onTeamChange}
        onStart={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("radio", { name: "Team B" }));

    expect(onTeamChange).toHaveBeenCalledWith("b");
  });

  it("holds Start until the teams are two against two", () => {
    const player = (id: string, team: "a" | "b" | null) => ({
      id,
      name: id,
      color: "#000000",
      cellsRemaining: 81,
      completionPercent: 0,
      team,
      mistakes: 0,
    });
    const state: RoomState = {
      ...BASE_STATE,
      mode: "teams",
      players: [
        player("p1", "a"),
        player("p2", "a"),
        player("p3", "b"),
        player("p4", null),
      ],
    };

    const { rerender } = render(
      <Lobby roomState={state} onStart={vi.fn()} onBack={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /start/i })).toBeDisabled();

    rerender(
      <Lobby
        roomState={{
          ...state,
          players: [...state.players.slice(0, 3), player("p4", "b")],
        }}
        onStart={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /start/i })).toBeEnabled();
  });
});
