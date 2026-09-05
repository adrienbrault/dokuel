import { readJson, writeJson } from "./storage.ts";
import type { Difficulty } from "./types.ts";

/**
 * The difficulty a new multiplayer room opens on. Creating a game no
 * longer walks through a picker - the host lands straight in the lobby,
 * where the difficulty is still theirs to change - so this remembers
 * what they raced on last instead of restarting everyone at medium.
 */

const KEY = "sudoku_mp_difficulty";

const DEFAULT_DIFFICULTY: Difficulty = "medium";

function parseDifficulty(value: unknown): Difficulty | null {
  return value === "easy" ||
    value === "medium" ||
    value === "hard" ||
    value === "expert"
    ? value
    : null;
}

export function getLastMultiplayerDifficulty(): Difficulty {
  return readJson<Difficulty>(KEY, DEFAULT_DIFFICULTY, parseDifficulty);
}

export function setLastMultiplayerDifficulty(difficulty: Difficulty): void {
  writeJson(KEY, difficulty);
}
