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

export type ActiveHint = {
  position: Position;
  value: number;
  technique: HintTechnique;
  explanation: string;
  relatedCells: Position[];
};

export type GameStatus = "idle" | "playing" | "completed";

// --- Assistance ---

export type AssistLevel = "paper" | "standard" | "full";

// --- Digit colors ---

/**
 * How the board paints digits.
 *
 * "off"    — one ink for givens, one for the player's own entries.
 * "digits" — each digit 1-9 keeps its glyph and takes its own hue.
 * "colors" — the glyph goes, leaving only the hue. Notes become dots,
 *            so a pencilled cell shows several colors at once.
 * "emoji"  — the glyph is covered by a symbol from the chosen theme.
 */
export type DigitColorMode = "off" | "digits" | "colors" | "emoji";

/**
 * A digit palette pinned down to one board: the mode plus the emoji
 * theme it draws from. The theme is carried even for modes that don't
 * read it, so switching back to "emoji" doesn't lose the pick.
 */
export type DigitStyle = {
  mode: DigitColorMode;
  emojiTheme: string;
};

// --- Numpad ---

/**
 * An async "beat my time" challenge carried by a solo board URL: who
 * set the time, how long it took, and whether hints helped.
 */
export type Challenge = {
  name: string;
  seconds: number;
  hinted: boolean;
};

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
  /**
   * The winner's completed board for solved claims, null for forfeit
   * claims (opponent gone — nothing to verify). Receivers only accept
   * a solved claim when this equals the room's solution.
   */
  winnerBoard: string | null;
  gameNumber: number;
  /**
   * The palette both boards draw with, or null when each player keeps
   * their own. Set by the host, for rooms where matching symbols are
   * the point ("we both play with the vehicles").
   */
  digitStyle: DigitStyle | null;
  /**
   * Players who asked for a rematch of the game that just ended, on the
   * room's current difficulty. The next board is dealt once every
   * seated player is in here; a vote for an earlier game or another
   * difficulty no longer counts.
   */
  rematchVotes: string[];
};
