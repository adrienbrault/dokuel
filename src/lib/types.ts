// --- Board Types ---

export type Difficulty = "easy" | "medium" | "hard" | "expert";

export type CellValue = number | null; // 1-9 or null (empty)

export type Cell = {
	value: CellValue;
	isGiven: boolean;
	notes: Set<number>;
};

export type Board = Cell[][];

export type Position = { row: number; col: number };

// --- Game State ---

export type MoveAction =
	| {
			type: "place";
			position: Position;
			value: number;
			previousValue: CellValue;
			previousNotes: Set<number>;
	  }
	| {
			type: "erase";
			position: Position;
			previousValue: CellValue;
			previousNotes: Set<number>;
	  }
	| { type: "toggleNote"; position: Position; note: number };

export type GameStatus = "idle" | "playing" | "completed";

export type GameState = {
	board: Board;
	solution: string;
	difficulty: Difficulty;
	status: GameStatus;
	selectedCell: Position | null;
	activeNumber: number | null; // for fill mode
	notesMode: boolean;
	timer: number; // seconds elapsed
	history: MoveAction[];
	conflicts: Set<string>; // "row,col" strings
};

// --- Numpad ---

export type NumPadPosition = "bottom" | "left" | "right";

// --- Multiplayer ---

export type RoomStatus = "lobby" | "playing" | "finished";

export type Player = {
	id: string;
	name: string;
	color: string;
	connected: boolean;
	cellsRemaining: number;
	completionPercent: number;
};

export type RoomState = {
	roomId: string;
	status: RoomStatus;
	difficulty: Difficulty;
	hostId: string;
	players: Player[];
	puzzle: string | null; // 81-char string, null in lobby
	winnerId: string | null;
	events: GameEvent[];
};

export type GameEvent = {
	type:
		| "share_progress"
		| "player_joined"
		| "player_left"
		| "game_started"
		| "game_won";
	playerId: string;
	timestamp: number;
	message: string;
};

// --- WebSocket Messages ---

export type ClientMessage =
	| { type: "join"; name: string; playerId: string }
	| { type: "ready" }
	| { type: "start_game" }
	| { type: "move"; position: Position; value: CellValue }
	| { type: "progress"; cellsRemaining: number; completionPercent: number }
	| { type: "complete"; board: string }
	| { type: "share_progress_request" }
	| { type: "share_progress_accept" }
	| { type: "share_progress_decline" }
	| { type: "rematch" };

export type ServerMessage =
	| { type: "room_state"; state: RoomState }
	| { type: "game_start"; puzzle: string }
	| {
			type: "opponent_progress";
			cellsRemaining: number;
			completionPercent: number;
	  }
	| { type: "opponent_disconnected" }
	| { type: "opponent_reconnected" }
	| {
			type: "share_progress_requested";
			fromPlayerId: string;
			fromPlayerName: string;
	  }
	| { type: "share_progress_result"; accepted: boolean; cells: string | null }
	| { type: "game_over"; winnerId: string; winnerName: string }
	| { type: "rematch_start"; puzzle: string }
	| { type: "error"; message: string };
