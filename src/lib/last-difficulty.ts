import type { Difficulty } from "./types.ts";

const STORAGE_KEY = "sudoku_last_difficulty";
const VALID: Set<string> = new Set(["easy", "medium", "hard", "expert"]);

export function getLastDifficulty(): Difficulty {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && VALID.has(raw)) return raw as Difficulty;
  } catch {
    // localStorage unavailable
  }
  return "medium";
}

export function setLastDifficulty(difficulty: Difficulty): void {
  try {
    localStorage.setItem(STORAGE_KEY, difficulty);
  } catch {
    // localStorage full or unavailable
  }
}
