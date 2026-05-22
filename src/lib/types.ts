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

export type ClearedNote = { row: number; col: number; note: number };

export type MoveAction =
  | {
      type: "place";
      position: Position;
      value: number;
      previousValue: CellValue;
      previousNotes: Set<number>;
      clearedNotes: ClearedNote[];
    }
  | {
      type: "erase";
      position: Position;
      previousValue: CellValue;
      previousNotes: Set<number>;
    }
  | { type: "toggleNote"; position: Position; note: number }
  | {
      type: "batchToggleNote";
      note: number;
      added: Position[];
      removed: Position[];
    }
  | {
      type: "batchErase";
      cells: {
        position: Position;
        previousValue: CellValue;
        previousNotes: Set<number>;
      }[];
    };

// --- Hint Explanation ---

export type HintTechnique = "naked-single" | "hidden-single";

export type ActiveHint = {
  position: Position;
  value: number;
  technique: HintTechnique;
  explanation: string;
  relatedCells: Position[];
};

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

// --- Assistance ---

export type AssistLevel = "paper" | "standard" | "full";

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
  assistLevel: AssistLevel;
  hostId: string;
  players: Player[];
  puzzle: string | null; // 81-char string, null in lobby
  solution: string | null; // 81-char string, null in lobby
  winnerId: string | null;
  winnerName: string | null;
  gameNumber: number;
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

// --- Async Challenge ---

/**
 * One progress sample from a challenger's solve. `t` is whole seconds
 * elapsed since they started; `p` is completion percent (0–100, integer).
 * A timeline is monotonic non-decreasing in both `t` and `p` — a ghost
 * bar never rewinds.
 */
export type GhostSample = { t: number; p: number };

/**
 * A self-contained async challenge artifact. Everything a friend's
 * client needs to replay the same puzzle and race the challenger's
 * ghost, with no server and no live peer. Versioned so a future
 * decoder can reject or migrate older blobs.
 */
export type Challenge = {
  /** Schema version. Bump on any breaking field change. */
  v: 1;
  /** 81-char puzzle string ('.' = empty). Carried in full because solo
   *  puzzles are not seeded. The solution is never transported — the
   *  friend's client derives it — so the link can't leak the answer. */
  puzzle: string;
  difficulty: Difficulty;
  assistLevel: AssistLevel;
  /** Challenger's display name. */
  challengerName: string;
  /** Challenger's completion time, whole seconds. */
  finalTime: number;
  /** Hints the challenger used, surfaced for fairness context. */
  hintsUsed: number;
  /** Monotonic progress timeline: first sample {t:0,p:0}, last {t:finalTime,p:100}. */
  ghost: GhostSample[];
};
