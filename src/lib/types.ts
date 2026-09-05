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

export type HintTechnique =
  | "naked-single"
  | "hidden-single"
  | "locked-candidates"
  | "naked-pair"
  | "hidden-pair"
  | "naked-triple"
  | "hidden-triple"
  | "naked-quad"
  | "hidden-quad"
  | "x-wing"
  | "xy-wing"
  | "swordfish"
  | "mistake"
  | "reveal";

export type HintStep = "nudge" | "pattern" | "elimination" | "reveal";

export type ActiveHint = {
  position: Position;
  value: number;
  technique: HintTechnique;
  explanation: string;
  relatedCells: Position[];
  /** Progressive teaching stage; omitted for legacy callers. */
  step?: HintStep | undefined;
  /** Explanations for eliminations needed before a decisive technique. */
  intermediateSteps?: string[] | undefined;
  /** True when the hint teaches an elimination without a resulting placement. */
  eliminationOnly?: boolean | undefined;
};

export type GameStatus = "idle" | "playing" | "completed";

// --- Assistance ---

export type AssistLevel = "paper" | "standard" | "full";

// --- Numpad ---

export type NumPadPosition = "bottom" | "left" | "right";

/**
 * A digit being carried by a live pointer: what the numpad's gesture
 * recognizer hands to the drag layer, and what the drag layer needs to
 * start following the pointer. `x`/`y` are viewport (client) pixels;
 * `pointerType` comes straight from `PointerEvent.pointerType`
 * ("touch" | "mouse" | "pen") and decides the touch lift.
 */
export type NumPadGesturePoint = {
  digit: number;
  x: number;
  y: number;
  pointerId: number;
  pointerType: string;
};

// --- Multiplayer ---

export type RoomStatus = "lobby" | "playing" | "finished";

export type Player = {
  id: string;
  name: string;
  color: string;
  cellsRemaining: number;
  completionPercent: number;
};

export type MultiplayerResult = {
  completedAt: number;
  board: string;
};

export type RoomState = {
  /** Players who agreed to replace the current game with a rematch. */
  rematchReady?: string[];
  /** Players who accepted the current lobby rules. */
  readyPlayers?: string[];
  /** Shared wall-clock instant at which the current game becomes live. */
  startedAt?: number | null;
  /** Verified completion proofs keyed by player id. */
  results?: Record<string, MultiplayerResult>;
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
  /**
   * The winner's completed board for solved claims, null for forfeit
   * claims (opponent gone — nothing to verify). Receivers only accept
   * a solved claim when this equals the room's solution.
   */
  winnerBoard: string | null;
  gameNumber: number;
};
