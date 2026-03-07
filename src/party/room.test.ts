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
	});
});
