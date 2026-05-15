import { readJson, removeKey, writeJson } from "./storage.ts";
import type { AssistLevel, Difficulty } from "./types.ts";

export type SavedGame = {
  puzzle: string;
  values: string;
  notes: number[][];
  timer: number;
  difficulty: Difficulty;
  assistLevel: AssistLevel;
};

const STORAGE_PREFIX = "sudoku_save_";

export function saveGame(key: string, data: SavedGame): void {
  writeJson(STORAGE_PREFIX + key, data);
}

function validateSavedGame(raw: unknown): SavedGame | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (
    typeof data.puzzle !== "string" ||
    data.puzzle.length !== 81 ||
    typeof data.values !== "string" ||
    data.values.length !== 81 ||
    !Array.isArray(data.notes) ||
    data.notes.length !== 81 ||
    typeof data.timer !== "number"
  ) {
    return null;
  }
  // Backward compat: migrate old showConflicts boolean to assistLevel
  if (!data.assistLevel && "showConflicts" in data) {
    data.assistLevel = data.showConflicts === false ? "paper" : "standard";
  }
  if (!data.assistLevel) {
    data.assistLevel = "standard";
  }
  return data as unknown as SavedGame;
}

export function loadGame(key: string): SavedGame | null {
  return readJson<SavedGame | null>(
    STORAGE_PREFIX + key,
    null,
    validateSavedGame,
  );
}

export type SavedGameSummary = {
  key: string;
  difficulty: Difficulty;
  filledCells: number;
  givenCells: number;
  timer: number;
};

export function listSavedGames(): SavedGameSummary[] {
  const results: SavedGameSummary[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (!storageKey?.startsWith(STORAGE_PREFIX)) continue;
      const key = storageKey.slice(STORAGE_PREFIX.length);
      // Skip daily challenge saves — they have their own entry point
      if (key.startsWith("daily-")) continue;
      const game = loadGame(key);
      if (!game) continue;
      const filledCells = game.values.split("").filter((c) => c !== ".").length;
      const givenCells = game.puzzle.split("").filter((c) => c !== ".").length;
      results.push({
        key,
        difficulty: game.difficulty,
        filledCells,
        givenCells,
        timer: game.timer,
      });
    }
  } catch {
    // localStorage unavailable
  }
  return results;
}

export function deleteGame(key: string): void {
  removeKey(STORAGE_PREFIX + key);
}
