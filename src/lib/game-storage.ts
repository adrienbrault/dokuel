import type { FriendChallenge } from "./challenge.ts";
import type { AssistLevel, Difficulty } from "./types.ts";

export type MultiplayerGameIdentity = {
  roomId: string;
  playerId: string;
  gameNumber: number;
  puzzle: string;
};

export function multiplayerGameKey(game: MultiplayerGameIdentity): string {
  return `mp_${game.roomId}_${game.gameNumber}_${encodeURIComponent(game.playerId)}_${game.puzzle}`;
}

export function loadMultiplayerGame(
  game: MultiplayerGameIdentity,
): SavedGame | null {
  const saved =
    loadGame(multiplayerGameKey(game)) ??
    loadGame(`mp_${game.roomId}_${game.puzzle.slice(0, 12)}`);
  return saved?.puzzle === game.puzzle ? saved : null;
}

export function saveMultiplayerGame(
  game: MultiplayerGameIdentity,
  data: SavedGame,
): void {
  saveGame(multiplayerGameKey(game), { ...data, multiplayer: game });
  // Consume the legacy identity after migration so another game cannot adopt it.
  if (loadGame(multiplayerGameKey(game))) {
    deleteGame(`mp_${game.roomId}_${game.puzzle.slice(0, 12)}`);
  }
}

export type SavedGame = {
  challenge?: FriendChallenge | undefined;
  multiplayer?: MultiplayerGameIdentity;
  puzzle: string;
  values: string;
  notes: number[][];
  timer: number;
  difficulty: Difficulty;
  assistLevel: AssistLevel;
  maxAssistLevel?: AssistLevel;
  // Hints taken so far. Persisted so a save/resume cycle can't launder
  // a hint-assisted game into PB eligibility.
  hintsUsed: number;
};

const STORAGE_PREFIX = "sudoku_save_";

export function saveGame(key: string, data: SavedGame): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
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

export function loadGame(key: string): SavedGame | null {
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
    return data as SavedGame;
  } catch {
    return null;
  }
}

export type SavedGameSummary = {
  challenge?: FriendChallenge | undefined;
  key: string;
  roomId?: string | undefined;
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
        challenge: game.challenge,
        roomId:
          game.multiplayer?.roomId ??
          (key.startsWith("mp_") ? key.split("_")[1] : undefined),
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
