import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RoomState, ServerMessage } from "../lib/types.ts";
import { useMultiplayer } from "./useMultiplayer.ts";

function createMockSocket() {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    addEventListener: vi.fn(
      (event: string, fn: (...args: unknown[]) => void) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(fn);
      },
    ),
    removeEventListener: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    emit(event: string, data?: unknown) {
      for (const fn of listeners[event] || []) {
        fn(data);
      }
    },
    listeners,
  };
}

const LOBBY_STATE: RoomState = {
  roomId: "room-1",
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

function serverMsg(msg: ServerMessage) {
  return { data: JSON.stringify(msg) };
}

describe("useMultiplayer", () => {
  it("sends join message on connect and processes room state", () => {
    const socket = createMockSocket();
    const { result } = renderHook(() =>
      useMultiplayer({
        socket: socket as unknown as WebSocket,
        playerId: "p1",
        playerName: "Alice",
      }),
    );

    // Simulate open event -> should send join
    act(() => socket.emit("open"));
    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "join", name: "Alice", playerId: "p1" }),
    );

    // Simulate room_state response
    act(() =>
      socket.emit(
        "message",
        serverMsg({ type: "room_state", state: LOBBY_STATE }),
      ),
    );

    expect(result.current.roomState).toEqual(LOBBY_STATE);
    expect(result.current.connected).toBe(true);
  });

  it("tracks opponent progress", () => {
    const socket = createMockSocket();
    const { result } = renderHook(() =>
      useMultiplayer({
        socket: socket as unknown as WebSocket,
        playerId: "p1",
        playerName: "Alice",
      }),
    );

    act(() => socket.emit("open"));
    act(() =>
      socket.emit(
        "message",
        serverMsg({
          type: "opponent_progress",
          cellsRemaining: 20,
          completionPercent: 75,
        }),
      ),
    );

    expect(result.current.opponentProgress).toEqual({
      cellsRemaining: 20,
      completionPercent: 75,
    });
  });

  it("provides sendStartGame and sendComplete actions", () => {
    const socket = createMockSocket();
    const { result } = renderHook(() =>
      useMultiplayer({
        socket: socket as unknown as WebSocket,
        playerId: "p1",
        playerName: "Alice",
      }),
    );

    act(() => result.current.sendStartGame());
    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "start_game" }),
    );

    act(() => result.current.sendComplete("123456789".repeat(9)));
    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "complete", board: "123456789".repeat(9) }),
    );
  });

  it("updates roomState status to playing on game_start", () => {
    const socket = createMockSocket();
    const { result } = renderHook(() =>
      useMultiplayer({
        socket: socket as unknown as WebSocket,
        playerId: "p1",
        playerName: "Alice",
      }),
    );

    act(() => socket.emit("open"));
    act(() =>
      socket.emit(
        "message",
        serverMsg({ type: "room_state", state: LOBBY_STATE }),
      ),
    );
    expect(result.current.roomState?.status).toBe("lobby");

    const puzzle = ".".repeat(81);
    act(() =>
      socket.emit("message", serverMsg({ type: "game_start", puzzle })),
    );

    expect(result.current.puzzle).toBe(puzzle);
    expect(result.current.roomState?.status).toBe("playing");
  });

  it("updates roomState status to playing on rematch_start", () => {
    const socket = createMockSocket();
    const { result } = renderHook(() =>
      useMultiplayer({
        socket: socket as unknown as WebSocket,
        playerId: "p1",
        playerName: "Alice",
      }),
    );

    act(() => socket.emit("open"));
    act(() =>
      socket.emit(
        "message",
        serverMsg({ type: "room_state", state: LOBBY_STATE }),
      ),
    );

    // First game
    const puzzle1 = ".".repeat(81);
    act(() =>
      socket.emit(
        "message",
        serverMsg({ type: "game_start", puzzle: puzzle1 }),
      ),
    );
    act(() =>
      socket.emit(
        "message",
        serverMsg({
          type: "game_over",
          winnerId: "p1",
          winnerName: "Alice",
        }),
      ),
    );
    expect(result.current.gameOver).toBeTruthy();

    // Rematch
    const puzzle2 = `1${".".repeat(80)}`;
    act(() =>
      socket.emit(
        "message",
        serverMsg({ type: "rematch_start", puzzle: puzzle2 }),
      ),
    );

    expect(result.current.puzzle).toBe(puzzle2);
    expect(result.current.roomState?.status).toBe("playing");
    expect(result.current.roomState?.winnerId).toBeNull();
    expect(result.current.gameOver).toBeNull();
    expect(result.current.opponentProgress).toBeNull();
  });

  it("clears error when room_state is received", () => {
    const socket = createMockSocket();
    const { result } = renderHook(() =>
      useMultiplayer({
        socket: socket as unknown as WebSocket,
        playerId: "p1",
        playerName: "Alice",
      }),
    );

    act(() => socket.emit("open"));

    // Receive an error
    act(() =>
      socket.emit(
        "message",
        serverMsg({
          type: "error",
          message: "Only the host can start the game",
        }),
      ),
    );
    expect(result.current.error).toBe("Only the host can start the game");

    // Receive room_state -> error should clear
    act(() =>
      socket.emit(
        "message",
        serverMsg({ type: "room_state", state: LOBBY_STATE }),
      ),
    );
    expect(result.current.error).toBeNull();
  });

  it("tracks opponent disconnection and reconnection", () => {
    const socket = createMockSocket();
    const { result } = renderHook(() =>
      useMultiplayer({
        socket: socket as unknown as WebSocket,
        playerId: "p1",
        playerName: "Alice",
      }),
    );

    act(() => socket.emit("open"));
    expect(result.current.opponentDisconnected).toBe(false);

    act(() =>
      socket.emit("message", serverMsg({ type: "opponent_disconnected" })),
    );
    expect(result.current.opponentDisconnected).toBe(true);

    act(() =>
      socket.emit("message", serverMsg({ type: "opponent_reconnected" })),
    );
    expect(result.current.opponentDisconnected).toBe(false);
  });

  it("sets connected to false on close", () => {
    const socket = createMockSocket();
    const { result } = renderHook(() =>
      useMultiplayer({
        socket: socket as unknown as WebSocket,
        playerId: "p1",
        playerName: "Alice",
      }),
    );

    act(() => socket.emit("open"));
    expect(result.current.connected).toBe(true);

    act(() => socket.emit("close"));
    expect(result.current.connected).toBe(false);
  });
});
