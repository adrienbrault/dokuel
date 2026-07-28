import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomState } from "../lib/types.ts";
import { MultiplayerGame } from "./MultiplayerGame.tsx";

const PUZZLE =
  "..4.7...2....89...8...6.9....6...54.7.....3..1............974...2..18.....3..5.6.";
const SOLUTION =
  "594173682267589134831462957386721549742956318159834276618397425425618793973245861";

const roomState: RoomState = {
  roomId: "test-room",
  status: "playing",
  difficulty: "medium",
  assistLevel: "standard",
  hostId: "me",
  players: [
    {
      id: "me",
      name: "Me",
      color: "#3B82F6",
      cellsRemaining: 55,
      completionPercent: 10,
    },
    {
      id: "opp",
      name: "Opponent",
      color: "#EF4444",
      cellsRemaining: 60,
      completionPercent: 5,
    },
  ],
  puzzle: PUZZLE,
  solution: SOLUTION,
  winnerId: null,
  winnerName: null,
  winnerBoard: null,
  gameNumber: 1,
};

function makeMp() {
  return {
    connected: true,
    roomState: roomState as RoomState | null,
    puzzle: PUZZLE as string | null,
    solution: SOLUTION as string | null,
    opponentProgress: null,
    opponentDisconnected: false,
    gameOver: null as { winnerId: string; winnerName: string } | null,
    hasStartedGame: true,
    roomFull: false,
    error: null,
    sendStartGame: vi.fn(),
    sendProgress: vi.fn(),
    sendComplete: vi.fn(),
    claimForfeitWin: vi.fn(),
    sendRematch: vi.fn(),
    updateName: vi.fn(),
    setAssistLevel: vi.fn(),
    setDifficulty: vi.fn(),
  };
}

let mockMp: ReturnType<typeof makeMp>;

vi.mock("../hooks/useYjsMultiplayer.ts", () => ({
  useYjsMultiplayer: () => mockMp,
}));

function renderGame() {
  return render(
    <MultiplayerGame
      playerId="me"
      playerName="Me"
      roomId="test-room"
      difficulty={null}
      onBack={() => {}}
    />,
  );
}

describe("MultiplayerGame full room", () => {
  beforeEach(() => {
    localStorage.clear();
    mockMp = makeMp();
  });

  it("shows the Game is full screen to an excess joiner", () => {
    mockMp.roomFull = true;
    mockMp.hasStartedGame = false;
    renderGame();
    expect(screen.getByText("Game is full")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });
});

describe("MultiplayerGame connecting state", () => {
  beforeEach(() => {
    localStorage.clear();
    mockMp = makeMp();
    mockMp.roomState = null;
    mockMp.puzzle = null;
    mockMp.solution = null;
    mockMp.hasStartedGame = false;
  });

  it("shows a plain connecting note at first", () => {
    renderGame();
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });

  it("offers troubleshooting after the connection stalls", () => {
    // Symmetric-NAT pairs (mobile carriers), a typo'd code, or an
    // expired room all used to present the same infinite spinner with
    // zero feedback and no way out.
    vi.useFakeTimers();
    try {
      renderGame();
      act(() => {
        vi.advanceTimersByTime(12_500);
      });
      expect(screen.getByText(/still trying to connect/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /retry/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("MultiplayerGame disconnect overlay", () => {
  beforeEach(() => {
    localStorage.clear();
    mockMp = makeMp();
  });

  it("shows the notice when the opponent's presence drops", () => {
    // opponentDisconnected is the awareness-derived signal — the only
    // one that actually reflects the opponent's connection.
    vi.useFakeTimers();
    try {
      mockMp.opponentDisconnected = true;
      renderGame();
      act(() => {
        vi.advanceTimersByTime(2_500);
      });
      expect(screen.getByText("Opponent disconnected")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits a beat before showing, so our own reconnect doesn't flash it", () => {
    // Right after we return from a background tab the opponent's
    // awareness hasn't re-synced yet — a blocking "opponent
    // disconnected" flash on every longer app switch reads as a bug.
    vi.useFakeTimers();
    try {
      mockMp.opponentDisconnected = true;
      renderGame();
      expect(
        screen.queryByText("Opponent disconnected"),
      ).not.toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(2_500);
      });
      expect(screen.getByText("Opponent disconnected")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the loser's board playable while the opponent is away", () => {
    // The grace period is exactly when the still-connected player wants
    // to race ahead — a full-screen blocking modal costs them 60s.
    vi.useFakeTimers();
    try {
      mockMp.opponentDisconnected = true;
      renderGame();
      act(() => {
        vi.advanceTimersByTime(2_500);
      });
      // A status banner, not a modal: jsdom has no hit-testing, so the
      // structural assertion is what actually pins "non-blocking".
      expect(screen.getByRole("status")).toHaveTextContent(
        "Opponent disconnected",
      );

      const cell = screen.getByLabelText(/Cell row 1 column 1, empty/);
      fireEvent.click(cell);
      const five = screen.getAllByLabelText("5")[0]!;
      fireEvent.pointerDown(five, { pointerType: "touch" });
      act(() => {
        vi.advanceTimersByTime(50);
      });
      fireEvent.pointerUp(five, { pointerType: "touch" });
      expect(
        screen.getByLabelText(/Cell row 1 column 1, value 5/),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("offers the claim button after the 60s countdown", () => {
    vi.useFakeTimers();
    try {
      mockMp.opponentDisconnected = true;
      renderGame();
      act(() => {
        vi.advanceTimersByTime(2_500);
      });
      expect(screen.queryByRole("button", { name: /claim win/i })).toBeNull();
      act(() => {
        vi.advanceTimersByTime(61_000);
      });
      const claim = screen.getByRole("button", { name: /claim win/i });
      fireEvent.click(claim);
      expect(mockMp.claimForfeitWin).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not show the overlay when only our own provider disconnected", () => {
    // provider.connected is a local intent flag: it goes false when WE
    // call disconnect() (e.g. the 15s tab-hide teardown), and says
    // nothing about the opponent. The old gating showed 'Opponent
    // disconnected' for our own backgrounding.
    mockMp.connected = false;
    renderGame();
    expect(screen.queryByText("Opponent disconnected")).not.toBeInTheDocument();
  });

  it("does not show the overlay once the game is over", () => {
    mockMp.opponentDisconnected = true;
    mockMp.gameOver = { winnerId: "me", winnerName: "Me" };
    renderGame();
    expect(screen.queryByText("Opponent disconnected")).not.toBeInTheDocument();
  });
});
