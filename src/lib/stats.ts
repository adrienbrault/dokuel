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

// History cap per (difficulty, assistLevel) bucket. Eviction must be
// scoped to the bucket the stats read over: a global ring let 100
// medium games evict an easy PB record, silently regressing the
// displayed best. 12 buckets × 100 small records stays well under any
// localStorage quota.
const MAX_GAMES_PER_BUCKET = 100;

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
  stats.push({
    difficulty,
    assistLevel,
    time,
    date: todayLocalISO(),
    won,
    hintsUsed: hintsUsed ?? 0,
  });
  writeJson(
    STORAGE_KEY,
    evictPerBucket(stats, (s) => s.difficulty + s.assistLevel),
  );
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
  const stats = getStats().filter(
    (s) =>
      s.difficulty === difficulty &&
      s.won &&
      (assistLevel === undefined || s.assistLevel === assistLevel),
  );
  if (stats.length === 0) return null;
  const times = stats.map((s) => s.time);
  // Best time only counts games without hints
  const unhinted = stats
    .filter((s) => !s.hintsUsed || s.hintsUsed === 0)
    .map((s) => s.time);
  return {
    gamesPlayed: stats.length,
    bestTime: unhinted.length > 0 ? Math.min(...unhinted) : Math.min(...times),
    averageTime: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
  };
}

const ASSIST_LEVELS: readonly AssistLevel[] = ["paper", "standard", "full"];

export type AssistLevelStats = {
  assistLevel: AssistLevel;
  gamesPlayed: number;
  bestTime: number;
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
