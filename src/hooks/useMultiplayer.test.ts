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
});
