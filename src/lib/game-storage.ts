import type { AssistLevel, Difficulty } from "./types.ts";

export type SavedGame = {
  puzzle: string;
  values: string;
  notes: number[][];
  timer: number;
  difficulty: Difficulty;
  assistLevel: AssistLevel;
  // Hints taken so far. Persisted so a save/resume cycle can't launder
  // a hint-assisted game into PB eligibility.
  hintsUsed: number;
};

/** A save as it sits in storage: the game plus the moment it was
 *  written. saveGame stamps it; callers never supply it. */
export type StoredGame = SavedGame & { updatedAt: number };

const STORAGE_PREFIX = "sudoku_save_";

/** Marks an autosave as belonging to a multiplayer room (see
 *  MultiplayerBoard), not to a resumable solo game. */
export const MULTIPLAYER_KEY_PREFIX = "mp_";

export function saveGame(key: string, data: SavedGame): void {
  try {
    const stored: StoredGame = { ...data, updatedAt: Date.now() };
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(stored));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

const BOARD_STRING = /^[1-9.]{81}$/;

function isValidNotes(notes: unknown): notes is number[][] {
  return (
    Array.isArray(notes) &&
    notes.length === 81 &&
    notes.every(
      (entry) =>
        Array.isArray(entry) &&
        entry.every(
          (n) =>
            typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 9,
        ),
    )
  );
}

export function loadGame(key: string): StoredGame | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Content-level validation, not just shape: anything let through
    // here is fed to initState during render on every app load, where
    // a stray character or non-array note entry throws.
    if (
      typeof data.puzzle !== "string" ||
      !BOARD_STRING.test(data.puzzle) ||
      typeof data.values !== "string" ||
      !BOARD_STRING.test(data.values) ||
      !isValidNotes(data.notes) ||
      typeof data.timer !== "number" ||
      !Number.isFinite(data.timer)
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
    // Backward compat: saves predate the field, and a corrupt value
    // shouldn't cost the whole game — worst case the player gets PB
    // eligibility they shouldn't have, same as the pre-field behavior.
    if (
      typeof data.hintsUsed !== "number" ||
      !Number.isInteger(data.hintsUsed) ||
      data.hintsUsed < 0
    ) {
      data.hintsUsed = 0;
    }
    // Saves written before the stamp existed sort as oldest rather
    // than as "just played" — the next autosave restamps them anyway.
    if (
      typeof data.updatedAt !== "number" ||
      !Number.isFinite(data.updatedAt)
    ) {
      data.updatedAt = 0;
    }
    return data as StoredGame;
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
  /** Epoch ms of the last autosave; drives most-recent-first order. */
  updatedAt: number;
};

/** A save is worth resuming once the player has entered a digit or a
 *  note of their own; until then it only carries the given puzzle. */
function hasProgress(game: StoredGame): boolean {
  if (game.values !== game.puzzle) return true;
  return game.notes.some((cellNotes) => cellNotes.length > 0);
}

export function listSavedGames(): SavedGameSummary[] {
  const results: SavedGameSummary[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (!storageKey?.startsWith(STORAGE_PREFIX)) continue;
      const key = storageKey.slice(STORAGE_PREFIX.length);
      // Skip daily challenge saves — they have their own entry point
      if (key.startsWith("daily-")) continue;
      // Skip duel autosaves — they belong to a room, and resuming one
      // from the landing would drop the player into a solo board
      // wearing their opponent's puzzle.
      if (key.startsWith(MULTIPLAYER_KEY_PREFIX)) continue;
      const game = loadGame(key);
      if (!game) continue;
      // An untouched board is a start the player walked away from, not
      // progress: opening a difficulty writes a save on the first
      // render, so listing those piles the landing with 0% rows that
      // hold nothing but a clock.
      if (!hasProgress(game)) continue;
      const filledCells = game.values.split("").filter((c) => c !== ".").length;
      const givenCells = game.puzzle.split("").filter((c) => c !== ".").length;
      results.push({
        key,
        difficulty: game.difficulty,
        filledCells,
        givenCells,
        timer: game.timer,
        updatedAt: game.updatedAt,
      });
    }
  } catch {
    // localStorage unavailable
  }
  return results.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deleteGame(key: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // silently ignore
  }
}

/**
 * Remove every saved game (including dailies) but nothing else — the
 * error boundary's recovery action for corrupted saves. Stats and
 * streak keys live outside the prefix and are untouched.
 */
export function clearAllSavedGames(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    for (const key of keys) {
      localStorage.removeItem(key);
    }
  } catch {
    // localStorage unavailable
  }
}
