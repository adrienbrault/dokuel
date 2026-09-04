import { loadGame, type SavedGame } from "./game-storage.ts";
import type { GameOrigin } from "./result-store-types.ts";

const STORAGE_PREFIX = "sudoku_save_";
const BOARD_STRING = /^[1-9.]{81}$/;

export type SavedGameBackupEntry = {
  key: string;
  data: SavedGame;
};

/** Return resumable solo saves without exporting room or player identity. */
export function exportSavedGames(): SavedGameBackupEntry[] {
  const entries: SavedGameBackupEntry[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (!storageKey?.startsWith(STORAGE_PREFIX)) continue;
      const key = storageKey.slice(STORAGE_PREFIX.length);
      if (key.startsWith("mp_")) continue;
      const game = loadGame(key);
      if (!game || game.multiplayer) continue;
      entries.push({ key, data: game });
    }
  } catch {
    return [];
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

/** Validate and replace portable saves, rolling back if any write fails. */
export function replaceSavedGames(entries: SavedGameBackupEntry[]): boolean {
  const prepared = prepareEntries(entries);
  if (!prepared) return false;

  const previous = readPortableRaw();
  if (!previous) return false;
  try {
    for (const storageKey of previous.keys()) {
      localStorage.removeItem(storageKey);
    }
    for (const [key, raw] of prepared) {
      localStorage.setItem(STORAGE_PREFIX + key, raw);
    }
    return true;
  } catch {
    restoreRaw(previous);
    return false;
  }
}

function prepareEntries(
  entries: SavedGameBackupEntry[],
): Map<string, string> | null {
  const prepared = new Map<string, string>();
  for (const entry of entries) {
    if (
      !isPortableSaveKey(entry.key) ||
      prepared.has(entry.key) ||
      !isPortableSavedGame(entry.data)
    ) {
      return null;
    }
    try {
      prepared.set(entry.key, JSON.stringify(entry.data));
    } catch {
      return null;
    }
  }
  return prepared;
}

function readPortableRaw(): Map<string, string> | null {
  const previous = new Map<string, string>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (!storageKey?.startsWith(STORAGE_PREFIX)) continue;
      const raw = localStorage.getItem(storageKey);
      if (raw !== null && isPortableStorageKey(storageKey, raw)) {
        previous.set(storageKey, raw);
      }
    }
    return previous;
  } catch {
    return null;
  }
}

function restoreRaw(previous: Map<string, string>): void {
  try {
    for (const [storageKey, raw] of previous) {
      localStorage.setItem(storageKey, raw);
    }
  } catch {
    // Best effort rollback; callers still receive a failed status.
  }
}

function isPortableSaveKey(key: string): boolean {
  return (
    typeof key === "string" &&
    key.length > 0 &&
    key.length <= 256 &&
    !key.startsWith("mp_")
  );
}

function isPortableStorageKey(storageKey: string, raw: string): boolean {
  const key = storageKey.slice(STORAGE_PREFIX.length);
  if (!isPortableSaveKey(key)) return false;
  try {
    const parsed = JSON.parse(raw) as { multiplayer?: unknown };
    return !parsed.multiplayer;
  } catch {
    return true;
  }
}

function isPortableSavedGame(value: unknown): value is SavedGame {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const data = value as Partial<SavedGame>;
  return (
    !data.multiplayer &&
    typeof data.puzzle === "string" &&
    BOARD_STRING.test(data.puzzle) &&
    typeof data.values === "string" &&
    BOARD_STRING.test(data.values) &&
    isValidNotes(data.notes) &&
    typeof data.timer === "number" &&
    Number.isFinite(data.timer) &&
    ["easy", "medium", "hard", "expert"].includes(data.difficulty ?? "") &&
    ["paper", "standard", "full"].includes(data.assistLevel ?? "") &&
    typeof data.hintsUsed === "number" &&
    Number.isInteger(data.hintsUsed) &&
    data.hintsUsed >= 0 &&
    (data.origin === undefined || isGameOrigin(data.origin)) &&
    isOptionalId(data.attemptId) &&
    isOptionalId(data.puzzleId)
  );
}

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

function isGameOrigin(value: unknown): value is GameOrigin {
  return (
    typeof value === "string" &&
    ["generated", "daily", "friend", "imported", "replay"].includes(value)
  );
}

function isOptionalId(value: unknown): value is string | undefined {
  return (
    value === undefined || (typeof value === "string" && value.length <= 256)
  );
}
