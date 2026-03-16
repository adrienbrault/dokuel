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
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function loadGame(key: string): SavedGame | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const data = JSON.parse(raw);
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
    return data as SavedGame;
  } catch {
    return null;
  }
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
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // silently ignore
  }
}
