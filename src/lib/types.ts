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
      clearedPeerNotes: Position[];
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
  notesMode: boolean;
  timer: number; // seconds elapsed
  history: MoveAction[];
  conflicts: Set<number>; // row*9+col keys
};

// --- Numpad ---

export type NumPadPosition = "bottom" | "left" | "right";

// --- Multiplayer ---

export type RoomStatus = "lobby" | "playing" | "finished";

export type Player = {
  id: string;
  name: string;
  color: string;
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
