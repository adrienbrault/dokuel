import { describe, expect, it } from "vitest";
import { GameRoom } from "./room.ts";

describe("GameRoom", () => {
	describe("join", () => {
		it("first player becomes host", () => {
			const room = new GameRoom("room-1");
			const messages = room.handleJoin("p1", "Alice");

			expect(room.state.hostId).toBe("p1");
			expect(room.state.players).toHaveLength(1);
			expect(room.state.players[0]).toMatchObject({
				id: "p1",
				name: "Alice",
				connected: true,
				cellsRemaining: 81,
				completionPercent: 0,
			});
			expect(room.state.status).toBe("lobby");

			// Should send room_state to all
			expect(messages).toHaveLength(1);
			expect(messages[0].target).toBe("all");
			expect(messages[0].message.type).toBe("room_state");
		});

		it("second player joins with different color", () => {
			const room = new GameRoom("room-1");
			room.handleJoin("p1", "Alice");
			const messages = room.handleJoin("p2", "Bob");

			expect(room.state.players).toHaveLength(2);
			expect(room.state.players[1]).toMatchObject({
				id: "p2",
				name: "Bob",
				connected: true,
			});
			// Different colors
			expect(room.state.players[0].color).not.toBe(
				room.state.players[1].color,
			);
			// Host unchanged
			expect(room.state.hostId).toBe("p1");
			// Broadcasts updated room state
			expect(messages).toHaveLength(1);
			expect(messages[0].target).toBe("all");
		});

		it("rejects third player when room is full", () => {
			const room = new GameRoom("room-1");
			room.handleJoin("p1", "Alice");
			room.handleJoin("p2", "Bob");
			const messages = room.handleJoin("p3", "Charlie");

			expect(room.state.players).toHaveLength(2);
			expect(messages).toHaveLength(1);
			expect(messages[0].target).toBe("sender");
			expect(messages[0].message).toMatchObject({
				type: "error",
				message: "Room is full",
			});
		});

		it("allows reconnecting player to rejoin", () => {
			const room = new GameRoom("room-1");
			room.handleJoin("p1", "Alice");
			room.handleJoin("p2", "Bob");
			room.handleDisconnect("p2");

			const messages = room.handleJoin("p2", "Bob");
			expect(room.state.players).toHaveLength(2);
			expect(room.state.players[1].connected).toBe(true);
			expect(messages[0].target).toBe("all");
		});
	});
});
