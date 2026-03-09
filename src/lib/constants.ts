import type { Difficulty } from "./types.ts";

export const GRID_SIZE = 9;
export const BOX_SIZE = 3;
export const BOARD_CELLS = 81;

export const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "expert"];

export const DEFAULT_DIFFICULTY: Difficulty = "medium";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
};

export const EMPTY_CONFLICTS: ReadonlySet<number> = new Set<number>();

export const SIGNALING_URL = "wss://signal.dokuel.com";

/** Centralized localStorage key registry. */
export const STORAGE_KEYS = {
  GAME_SAVE_PREFIX: "sudoku_save_",
  FRIENDS: "sudoku_friends",
  STATS: "sudoku_stats",
  DAILY_STREAK: "sudoku_daily_streak",
  SOUND: "sudoku_sound",
  PLAYER_ID: "sudoku_player_id",
  PLAYER_NAME: "sudoku_player_name",
  THEME: "sudoku_theme",
  ASSIST_LEVEL: "sudoku_assist_level",
  NUMPAD_POSITION: "sudoku-numpad-position",
  OPPONENT_PROGRESS: "sudoku-opponent-progress-visible",
  NUMPAD_TIP_DISMISSED: "sudoku_numpad_tip_dismissed",
} as const;
