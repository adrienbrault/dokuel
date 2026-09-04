import { todayLocalISO } from "./date.ts";
import { readJson, writeJson } from "./storage.ts";
import type { AssistLevel, Difficulty } from "./types.ts";

export type GameStats = {
  difficulty: Difficulty;
  assistLevel: AssistLevel;
  time: number;
  date: string;
  won: boolean;
  hintsUsed?: number;
};

const STORAGE_KEY = "sudoku_stats";
const LIFETIME_STORAGE_KEY = "sudoku_stats_lifetime";

// History cap per (difficulty, assistLevel) bucket. Eviction must be
// scoped to the bucket the stats read over: a global ring let 100
// medium games evict an easy PB record, silently regressing the
// displayed best. 12 buckets × 100 small records stays well under any
// localStorage quota.
const MAX_GAMES_PER_BUCKET = 100;

export type StatsSummary = {
  gamesPlayed: number;
  bestTime: number | null;
  averageTime: number;
};

type LifetimeBucket = {
  gamesPlayed: number;
  totalTime: number;
  bestTime: number | null;
};

type LifetimeStore = {
  version: 1;
  buckets: Record<string, LifetimeBucket>;
};

export function getStats(): GameStats[] {
  return readJson<GameStats[]>(STORAGE_KEY, [], (parsed) => {
    if (!Array.isArray(parsed)) return null;
    // Entries saved before assist-level tracking default to "standard",
    // the only mode the game offered at the time.
    return (parsed as GameStats[]).map((s) => ({
      ...s,
      assistLevel: s.assistLevel ?? "standard",
    }));
  });
}

export function saveGameResult(
  difficulty: Difficulty,
  assistLevel: AssistLevel,
  time: number,
  won: boolean,
  hintsUsed?: number,
) {
  const stats = getStats();
  const result: GameStats = {
    difficulty,
    assistLevel,
    time,
    date: todayLocalISO(),
    won,
    hintsUsed: hintsUsed ?? 0,
  };
  const lifetime = readLifetimeStore(stats);
  stats.push(result);
  const retained = evictPerBucket(stats, (s) => s.difficulty + s.assistLevel);
  writeJson(STORAGE_KEY, retained);
  addToLifetime(lifetime, result);
  writeJson(LIFETIME_STORAGE_KEY, lifetime);
  return summarizeLifetime(lifetime, difficulty, assistLevel);
}

/** Drop the oldest entries of any bucket that exceeds the cap,
 *  preserving overall insertion order. */
function evictPerBucket<T>(entries: T[], bucketOf: (entry: T) => string): T[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const bucket = bucketOf(entry);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  const excess = new Map<string, number>();
  for (const [bucket, count] of counts) {
    if (count > MAX_GAMES_PER_BUCKET) {
      excess.set(bucket, count - MAX_GAMES_PER_BUCKET);
    }
  }
  if (excess.size === 0) return entries;
  return entries.filter((entry) => {
    const bucket = bucketOf(entry);
    const over = excess.get(bucket) ?? 0;
    if (over === 0) return true;
    excess.set(bucket, over - 1);
    return false;
  });
}

export function getStatsForDifficulty(
  difficulty: Difficulty,
  assistLevel?: AssistLevel,
) {
  return summarizeLifetime(
    readLifetimeStore(getStats()),
    difficulty,
    assistLevel,
  );
}

function summarizeLifetime(
  lifetime: LifetimeStore,
  difficulty: Difficulty,
  assistLevel?: AssistLevel,
): StatsSummary | null {
  const buckets = Object.entries(lifetime.buckets).filter(([key]) => {
    const [bucketDifficulty, bucketAssistLevel] = key.split("\u0000");
    return (
      bucketDifficulty === difficulty &&
      (assistLevel === undefined || bucketAssistLevel === assistLevel)
    );
  });
  if (buckets.length === 0) return null;
  const gamesPlayed = buckets.reduce(
    (total, [, bucket]) => total + bucket.gamesPlayed,
    0,
  );
  if (gamesPlayed === 0) return null;
  const totalTime = buckets.reduce(
    (total, [, bucket]) => total + bucket.totalTime,
    0,
  );
  const bestTime = buckets.reduce<number | null>(
    (best, [, bucket]) =>
      bucket.bestTime === null
        ? best
        : best === null
          ? bucket.bestTime
          : Math.min(best, bucket.bestTime),
    null,
  );
  return {
    gamesPlayed,
    bestTime,
    averageTime: Math.round(totalTime / gamesPlayed),
  };
}

function bucketKey(difficulty: Difficulty, assistLevel: AssistLevel): string {
  return `${difficulty}\u0000${assistLevel}`;
}

function emptyLifetimeStore(): LifetimeStore {
  return { version: 1, buckets: {} };
}

function isLifetimeBucket(value: unknown): value is LifetimeBucket {
  if (typeof value !== "object" || value === null) return false;
  const bucket = value as Partial<LifetimeBucket>;
  const gamesPlayed = bucket.gamesPlayed;
  return (
    typeof gamesPlayed === "number" &&
    Number.isSafeInteger(gamesPlayed) &&
    gamesPlayed >= 0 &&
    typeof bucket.totalTime === "number" &&
    Number.isFinite(bucket.totalTime) &&
    (bucket.bestTime === null ||
      (typeof bucket.bestTime === "number" && Number.isFinite(bucket.bestTime)))
  );
}

function validateLifetimeStore(value: unknown): LifetimeStore | null {
  if (typeof value !== "object" || value === null) return null;
  const store = value as Partial<LifetimeStore>;
  if (
    store.version !== 1 ||
    typeof store.buckets !== "object" ||
    store.buckets === null
  ) {
    return null;
  }
  const buckets: Record<string, LifetimeBucket> = {};
  for (const [key, bucket] of Object.entries(store.buckets)) {
    if (!isLifetimeBucket(bucket)) return null;
    buckets[key] = bucket;
  }
  return { version: 1, buckets };
}

function readLifetimeStore(history: GameStats[]): LifetimeStore {
  const raw = readJson<unknown>(
    LIFETIME_STORAGE_KEY,
    undefined,
    (value) => value,
  );
  const stored = validateLifetimeStore(raw);
  if (stored !== null) return stored;
  const migrated = emptyLifetimeStore();
  for (const result of history) addToLifetime(migrated, result);
  writeJson(LIFETIME_STORAGE_KEY, migrated);
  return migrated;
}

function addToLifetime(lifetime: LifetimeStore, result: GameStats): void {
  if (!result.won || !Number.isFinite(result.time)) return;
  const key = bucketKey(result.difficulty, result.assistLevel);
  let bucket = lifetime.buckets[key];
  if (!bucket) {
    bucket = { gamesPlayed: 0, totalTime: 0, bestTime: null };
    lifetime.buckets[key] = bucket;
  }
  bucket.gamesPlayed += 1;
  bucket.totalTime += result.time;
  if (!result.hintsUsed || result.hintsUsed === 0) {
    bucket.bestTime =
      bucket.bestTime === null
        ? result.time
        : Math.min(bucket.bestTime, result.time);
  }
}

const ASSIST_LEVELS: readonly AssistLevel[] = ["paper", "standard", "full"];

export type AssistLevelStats = {
  assistLevel: AssistLevel;
  gamesPlayed: number;
  bestTime: number | null;
  averageTime: number;
};

/**
 * Per-assist-mode win stats for a difficulty, in paper/standard/full
 * order. Modes with no win are omitted so callers render only the
 * rows that have data.
 */
export function getStatsByAssistLevel(
  difficulty: Difficulty,
): AssistLevelStats[] {
  return ASSIST_LEVELS.flatMap((level) => {
    const stats = getStatsForDifficulty(difficulty, level);
    return stats ? [{ assistLevel: level, ...stats }] : [];
  });
}
