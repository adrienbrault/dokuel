import { render, screen } from "@testing-library/react";
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
  gameNumber: 1,
  events: [],
};

function makeMp() {
  return {
    connected: true,
    roomState,
    puzzle: PUZZLE,
    solution: SOLUTION,
    opponentProgress: null,
    opponentDisconnected: false,
    gameOver: null as { winnerId: string; winnerName: string } | null,
    hasStartedGame: true,
    error: null,
    sendStartGame: vi.fn(),
    sendProgress: vi.fn(),
    sendComplete: vi.fn(),
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

describe("MultiplayerGame disconnect overlay", () => {
  beforeEach(() => {
    localStorage.clear();
    mockMp = makeMp();
  });

  it("shows the overlay when the opponent's presence drops", () => {
    // opponentDisconnected is the awareness-derived signal — the only
    // one that actually reflects the opponent's connection.
    mockMp.opponentDisconnected = true;
    renderGame();
    expect(screen.getByText("Opponent disconnected")).toBeInTheDocument();
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
