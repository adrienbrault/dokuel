import type { Player, RoomState, ServerMessage } from "../lib/types.ts";

const PLAYER_COLORS = [
	"#3B82F6", // blue
	"#EF4444", // red
	"#10B981", // emerald
	"#F59E0B", // amber
];

export type OutgoingMessage = {
	target: "sender" | "opponent" | "all";
	message: ServerMessage;
};

export class GameRoom {
	state: RoomState;
	solution: string | null = null;

	constructor(roomId: string) {
		this.state = {
			roomId,
			status: "lobby",
			difficulty: "medium",
			hostId: "",
			players: [],
			puzzle: null,
			winnerId: null,
			events: [],
		};
	}

	handleJoin(playerId: string, name: string): OutgoingMessage[] {
		const player: Player = {
			id: playerId,
			name,
			color: PLAYER_COLORS[this.state.players.length % PLAYER_COLORS.length],
			connected: true,
			cellsRemaining: 81,
			completionPercent: 0,
		};

		this.state.players.push(player);

		if (this.state.players.length === 1) {
			this.state.hostId = playerId;
		}

		return [{ target: "all", message: { type: "room_state", state: this.state } }];
	}
}
