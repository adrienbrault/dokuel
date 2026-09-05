import {
  type DailyStreakBackup,
  exportDailyStreak,
  importDailyStreak,
  validateDailyStreakBackup,
} from "./daily-streak-backup.ts";
import type { TechniqueProgressMap } from "./learning-progress.ts";
import {
  exportLearningProgress,
  importLearningProgress,
  validateLearningProgress,
} from "./learning-progress-backup.ts";
import {
  exportMultiplayerStats,
  importMultiplayerStats,
  type MultiplayerStatsBackup,
  validateMultiplayerStatsBackup,
} from "./multiplayer-stats.ts";
import {
  exportSavedGames,
  replaceSavedGames,
  type SavedGameBackupEntry,
  validateSavedGameEntries,
} from "./portable-game-storage.ts";
import {
  exportResultStore,
  importResultStore,
  validateResultStore,
} from "./result-store.ts";
import type { ResultStore } from "./result-store-types.ts";

const RESULT_KEY = "sudoku_result_store";
const STREAK_KEY = "sudoku_daily_streak";
const LIFETIME_STREAK_KEY = "sudoku_daily_streak_lifetime";
const SAVE_PREFIX = "sudoku_save_";
const MULTIPLAYER_KEY = "sudoku_multiplayer_stats";

export type ProgressBackup = {
  version: 1;
  savedGames: SavedGameBackupEntry[];
  resultStore: ResultStore;
  dailyStreak: DailyStreakBackup;
  learningProgress: TechniqueProgressMap;
  /** Optional for v1 imports created before multiplayer backups existed. */
  multiplayerStats?: MultiplayerStatsBackup;
};

export type BackupPreview = {
  savedGames: number;
  resultCount: number;
  lifetimeGamesPlayed: number;
  currentStreak: number;
  longestStreak: number;
  learningAttempts: number;
  multiplayerResultCount: number;
  multiplayerGamesPlayed: number;
};

export function exportBackup(): ProgressBackup {
  return {
    version: 1,
    savedGames: exportSavedGames(),
    resultStore: exportResultStore(),
    dailyStreak: exportDailyStreak(),
    learningProgress: exportLearningProgress(),
    multiplayerStats: exportMultiplayerStats(),
  };
}

export function exportBackupJson(): string {
  return JSON.stringify(exportBackup());
}

export function validateBackup(value: unknown): ProgressBackup | null {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  if (
    !isRecord(parsed) ||
    parsed.version !== 1 ||
    !hasOnlyKeys(parsed, [
      "version",
      "savedGames",
      "resultStore",
      "dailyStreak",
      "learningProgress",
      "multiplayerStats",
    ])
  ) {
    return null;
  }
  const savedGames = validateSavedGameEntries(parsed.savedGames);
  const resultStore = validateResultStore(parsed.resultStore);
  const dailyStreak = validateDailyStreakBackup(parsed.dailyStreak);
  const learningProgress = validateLearningProgress(parsed.learningProgress);
  const multiplayerStats =
    parsed.multiplayerStats === undefined
      ? undefined
      : validateMultiplayerStatsBackup(parsed.multiplayerStats);
  if (
    !savedGames ||
    !resultStore ||
    !dailyStreak ||
    !learningProgress ||
    (parsed.multiplayerStats !== undefined && !multiplayerStats)
  ) {
    return null;
  }
  return {
    version: 1,
    savedGames,
    resultStore,
    dailyStreak,
    learningProgress,
    ...(multiplayerStats ? { multiplayerStats } : {}),
  };
}

export function previewBackup(value: unknown): BackupPreview | null {
  const backup = validateBackup(value);
  if (!backup) return null;
  return {
    savedGames: backup.savedGames.length,
    resultCount: backup.resultStore.recent.length,
    lifetimeGamesPlayed: Object.values(
      backup.resultStore.lifetime.buckets,
    ).reduce((total, bucket) => total + bucket.gamesPlayed, 0),
    currentStreak: backup.dailyStreak.streak.currentStreak,
    longestStreak: backup.dailyStreak.streak.longestStreak,
    learningAttempts: Object.values(backup.learningProgress).reduce(
      (total, progress) => total + progress.attempts,
      0,
    ),
    multiplayerResultCount: backup.multiplayerStats?.recent.length ?? 0,
    multiplayerGamesPlayed: backup.multiplayerStats
      ? Object.values(backup.multiplayerStats.lifetime.buckets).reduce(
          (total, bucket) => total + bucket.gamesPlayed,
          0,
        )
      : 0,
  };
}

/** Replace portable progress after the caller has shown a preview. */
export function importBackup(value: unknown): boolean {
  const backup = validateBackup(value);
  if (!backup) return false;
  const snapshot = snapshotStorage();
  if (!snapshot) return false;
  let savesChanged = false;
  let resultsChanged = false;
  let streakChanged = false;
  let multiplayerChanged = false;
  try {
    if (!replaceSavedGames(backup.savedGames)) return false;
    savesChanged = true;
    if (!importResultStore(backup.resultStore)) {
      restoreChanged(
        snapshot,
        savesChanged,
        resultsChanged,
        streakChanged,
        multiplayerChanged,
      );
      return false;
    }
    resultsChanged = true;
    if (!importDailyStreak(backup.dailyStreak)) {
      restoreChanged(
        snapshot,
        savesChanged,
        resultsChanged,
        streakChanged,
        multiplayerChanged,
      );
      return false;
    }
    streakChanged = true;
    if (backup.multiplayerStats) {
      if (!importMultiplayerStats(backup.multiplayerStats)) {
        restoreChanged(
          snapshot,
          savesChanged,
          resultsChanged,
          streakChanged,
          multiplayerChanged,
        );
        return false;
      }
      multiplayerChanged = true;
    }
    if (!importLearningProgress(backup.learningProgress)) {
      restoreChanged(
        snapshot,
        savesChanged,
        resultsChanged,
        streakChanged,
        multiplayerChanged,
      );
      return false;
    }
    return true;
  } catch {
    restoreChanged(
      snapshot,
      savesChanged,
      resultsChanged,
      streakChanged,
      multiplayerChanged,
    );
    return false;
  }
}

/** Naming makes the replacement semantics explicit at a confirmation UI. */
export const replaceFromBackup = importBackup;

function snapshotStorage(): Map<string, string> | null {
  const snapshot = new Map<string, string>();
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      const value = key === null ? null : localStorage.getItem(key);
      if (key !== null && value !== null) snapshot.set(key, value);
    }
    return snapshot;
  } catch {
    return null;
  }
}

function restoreChanged(
  snapshot: Map<string, string>,
  savesChanged: boolean,
  resultsChanged: boolean,
  streakChanged: boolean,
  multiplayerChanged: boolean,
): void {
  const keys = savesChanged ? saveKeys(snapshot) : new Set<string>();
  if (resultsChanged) keys.add(RESULT_KEY);
  if (streakChanged) {
    keys.add(STREAK_KEY);
    keys.add(LIFETIME_STREAK_KEY);
  }
  if (multiplayerChanged) keys.add(MULTIPLAYER_KEY);
  for (const key of keys) restoreKey(key, snapshot.get(key) ?? null);
}

function saveKeys(snapshot: Map<string, string>): Set<string> {
  const keys = new Set<string>();
  for (const key of snapshot.keys()) {
    if (key.startsWith(SAVE_PREFIX)) keys.add(key);
  }
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith(SAVE_PREFIX)) keys.add(key);
    }
  } catch {
    // Continue with the keys captured before the failed write.
  }
  return keys;
}

function restoreKey(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Best effort rollback; import still reports failure.
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
