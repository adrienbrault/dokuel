import { generatePuzzle, solvePuzzle } from "../lib/sudoku.ts";
import type {
	Difficulty,
	Player,
	RoomState,
	ServerMessage,
} from "../lib/types.ts";

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
		// Reconnecting player
		const existing = this.state.players.find((p) => p.id === playerId);
		if (existing) {
			existing.connected = true;
			return [
				{ target: "all", message: { type: "room_state", state: this.state } },
			];
		}

		// Room full
		if (this.state.players.length >= 2) {
			return [
				{
					target: "sender",
					message: { type: "error", message: "Room is full" },
				},
			];
		}

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

		return [
			{ target: "all", message: { type: "room_state", state: this.state } },
		];
	}

	handleStartGame(
		playerId: string,
		difficulty: Difficulty,
	): OutgoingMessage[] {
		if (playerId !== this.state.hostId) {
			return [
				{
					target: "sender",
					message: {
						type: "error",
						message: "Only the host can start the game",
					},
				},
			];
		}

		if (this.state.players.length < 2) {
			return [
				{
					target: "sender",
					message: { type: "error", message: "Need 2 players to start" },
				},
			];
		}

		const puzzle = generatePuzzle(difficulty);
		this.solution = solvePuzzle(puzzle);
		this.state.puzzle = puzzle;
		this.state.difficulty = difficulty;
		this.state.status = "playing";

		// Reset player progress
		for (const player of this.state.players) {
			const clueCount = puzzle.split("").filter((c) => c !== ".").length;
			player.cellsRemaining = 81 - clueCount;
			player.completionPercent = 0;
		}

		return [
			{ target: "all", message: { type: "game_start", puzzle } },
		];
	}

	handleDisconnect(playerId: string): OutgoingMessage[] {
		const player = this.state.players.find((p) => p.id === playerId);
		if (!player) return [];
		player.connected = false;
		return [
			{
				target: "opponent",
				message: { type: "opponent_disconnected" },
			},
		];
	}
}
