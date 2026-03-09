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
