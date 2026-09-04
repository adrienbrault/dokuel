import { loadGame, type SavedGame } from "./game-storage.ts";
import type { GameOrigin } from "./result-store-types.ts";

const STORAGE_PREFIX = "sudoku_save_";
const BOARD_STRING = /^[1-9.]{81}$/;
const SAVED_GAME_KEYS = [
  "challenge",
  "puzzle",
  "values",
  "notes",
  "timer",
  "difficulty",
  "assistLevel",
  "maxAssistLevel",
  "hintsUsed",
  "origin",
  "attemptId",
  "puzzleId",
] as const;

export type SavedGameBackupEntry = {
  key: string;
  data: SavedGame;
};

export function validateSavedGameEntries(
  value: unknown,
): SavedGameBackupEntry[] | null {
  if (!Array.isArray(value)) return null;
  const entries: SavedGameBackupEntry[] = [];
  const keys = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) return null;
    const key = item.key;
    const data = item.data;
    if (
      typeof key !== "string" ||
      keys.has(key) ||
      !isPortableSaveKey(key) ||
      !isPortableSavedGame(data)
    ) {
      return null;
    }
    keys.add(key);
    entries.push({ key, data });
  }
  return entries;
}

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
      entries.push({ key, data: portableCopy(game) });
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
  const validated = validateSavedGameEntries(entries);
  if (!validated) return null;
  const prepared = new Map<string, string>();
  for (const entry of validated) {
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
    const currentPortable = new Set<string>();
    for (let index = 0; index < localStorage.length; index++) {
      const storageKey = localStorage.key(index);
      if (!storageKey?.startsWith(STORAGE_PREFIX)) continue;
      const raw = localStorage.getItem(storageKey);
      if (raw !== null && isPortableStorageKey(storageKey, raw)) {
        currentPortable.add(storageKey);
      }
    }
    for (const storageKey of currentPortable) {
      if (!previous.has(storageKey)) localStorage.removeItem(storageKey);
    }
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
    Object.keys(data).every((key) =>
      SAVED_GAME_KEYS.some((allowed) => allowed === key),
    ) &&
    !data.multiplayer &&
    typeof data.puzzle === "string" &&
    BOARD_STRING.test(data.puzzle) &&
    typeof data.values === "string" &&
    BOARD_STRING.test(data.values) &&
    isValidNotes(data.notes) &&
    typeof data.timer === "number" &&
    Number.isFinite(data.timer) &&
    (data.challenge === undefined || isValidChallenge(data.challenge)) &&
    ["easy", "medium", "hard", "expert"].includes(data.difficulty ?? "") &&
    ["paper", "standard", "full"].includes(data.assistLevel ?? "") &&
    (data.maxAssistLevel === undefined ||
      ["paper", "standard", "full"].includes(data.maxAssistLevel)) &&
    typeof data.hintsUsed === "number" &&
    Number.isInteger(data.hintsUsed) &&
    data.hintsUsed >= 0 &&
    (data.origin === undefined || isGameOrigin(data.origin)) &&
    isOptionalId(data.attemptId) &&
    isOptionalId(data.puzzleId)
  );
}

function isValidChallenge(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const challengeKeys = [
    "version",
    "puzzle",
    "difficulty",
    "assistLevel",
    "timeSeconds",
    "hintsUsed",
  ];
  return (
    Object.keys(value).every((key) => challengeKeys.includes(key)) &&
    value.version === 1 &&
    typeof value.puzzle === "string" &&
    BOARD_STRING.test(value.puzzle) &&
    ["easy", "medium", "hard", "expert"].includes(String(value.difficulty)) &&
    ["paper", "standard", "full"].includes(String(value.assistLevel)) &&
    typeof value.timeSeconds === "number" &&
    Number.isSafeInteger(value.timeSeconds) &&
    value.timeSeconds >= 0 &&
    typeof value.hintsUsed === "number" &&
    Number.isSafeInteger(value.hintsUsed) &&
    value.hintsUsed >= 0
  );
}

function portableCopy(game: SavedGame): SavedGame {
  return {
    ...(game.challenge === undefined ? {} : { challenge: game.challenge }),
    puzzle: game.puzzle,
    values: game.values,
    notes: game.notes.map((entry) => [...entry]),
    timer: game.timer,
    difficulty: game.difficulty,
    assistLevel: game.assistLevel,
    ...(game.maxAssistLevel === undefined
      ? {}
      : { maxAssistLevel: game.maxAssistLevel }),
    hintsUsed: game.hintsUsed,
    ...(game.origin === undefined ? {} : { origin: game.origin }),
    ...(game.attemptId === undefined ? {} : { attemptId: game.attemptId }),
    ...(game.puzzleId === undefined ? {} : { puzzleId: game.puzzleId }),
  };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
