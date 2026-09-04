import { todayLocalISO } from "./date.ts";
import {
  migrateLegacyLifetime,
  normalizeLegacyRecords,
  normalizeOrigin,
  validateStore,
} from "./result-store-schema.ts";
import type {
  GameOrigin,
  GameStats,
  LifetimeStore,
  RecordedResult,
  ResultInput,
  ResultStore,
  StatsSummary,
} from "./result-store-types.ts";
import { readJson, writeJson } from "./storage.ts";
import type { AssistLevel, Difficulty } from "./types.ts";

export type {
  GameOrigin,
  GameStats,
  RecordedResult,
  ResultInput,
  ResultMetadata,
  StatsSummary,
} from "./result-store-types.ts";

const RESULT_STORE_KEY = "sudoku_result_store";
const LEGACY_STATS_KEY = "sudoku_stats";
const LEGACY_LIFETIME_KEY = "sudoku_stats_lifetime";
const MAX_RECENT_PER_BUCKET = 100;

export function readRecentResults(): GameStats[] {
  const stored = readEnvelope();
  if (stored) return stored.recent;
  return readJson<GameStats[]>(LEGACY_STATS_KEY, [], (parsed) => {
    if (!Array.isArray(parsed)) return null;
    return (parsed as GameStats[]).map((record) => ({
      ...record,
      assistLevel: record.assistLevel ?? "standard",
    }));
  });
}

export function recordResult(input: ResultInput): RecordedResult {
  const store = loadStore();
  const attemptId = cleanId(input.metadata?.attemptId);
  const previous = attemptId ? store.attempts[attemptId] : undefined;
  if (previous) {
    return {
      record: previous,
      summary: summarize(
        store.lifetime,
        previous.difficulty,
        previous.assistLevel,
        normalizeOrigin(previous),
      ),
      duplicate: true,
    };
  }

  const puzzleId = cleanId(input.metadata?.puzzleId);
  const record: GameStats = {
    difficulty: input.difficulty,
    assistLevel: input.assistLevel,
    time: input.time,
    date: input.metadata?.date ?? todayLocalISO(),
    won: input.won,
    hintsUsed: input.hintsUsed ?? 0,
    origin: input.metadata?.origin ?? "generated",
    ...(attemptId ? { attemptId } : {}),
    ...(puzzleId ? { puzzleId } : {}),
  };
  store.recent = evictRecent([...store.recent, record]);
  addToLifetime(store.lifetime, record);
  if (attemptId) store.attempts[attemptId] = record;
  // Recent history, lifetime aggregates, and the attempt index share one
  // versioned envelope so a quota failure cannot persist only part of a win.
  writeJson(RESULT_STORE_KEY, store);
  return {
    record,
    summary: summarize(
      store.lifetime,
      record.difficulty,
      record.assistLevel,
      normalizeOrigin(record),
    ),
    duplicate: false,
  };
}

export function getSummary(
  difficulty: Difficulty,
  assistLevel?: AssistLevel,
  origin: GameOrigin = "generated",
): StatsSummary | null {
  return summarize(loadStore().lifetime, difficulty, assistLevel, origin);
}

export function getRecentResultsForOrigin(origin: GameOrigin): GameStats[] {
  return readRecentResults().filter(
    (record) => normalizeOrigin(record) === origin,
  );
}

function loadStore(): ResultStore {
  const stored = readEnvelope();
  if (stored) return stored;
  const recent = normalizeLegacyRecords(readLegacyRaw());
  const lifetime = migrateLifetime(recent);
  const attempts: Record<string, GameStats> = {};
  for (const record of recent) {
    if (record.attemptId) attempts[record.attemptId] = record;
  }
  return { version: 1, recent, lifetime, attempts };
}

function readEnvelope(): ResultStore | null {
  const raw = readJson<unknown>(RESULT_STORE_KEY, undefined, (value) => value);
  return validateStore(raw);
}

function readLegacyRaw(): unknown {
  return readJson<unknown>(LEGACY_STATS_KEY, [], (value) => value);
}

function migrateLifetime(recent: GameStats[]): LifetimeStore {
  const legacy = readJson<unknown>(
    LEGACY_LIFETIME_KEY,
    undefined,
    (value) => value,
  );
  const migrated = migrateLegacyLifetime(legacy);
  if (migrated) {
    // The old aggregate had no provenance. Move any explicitly classified
    // retained record out of its generated bucket during migration.
    for (const record of recent) {
      if (normalizeOrigin(record) === "generated") continue;
      subtractFromLifetime(migrated, record, "generated");
      addToLifetime(migrated, record);
    }
    return migrated;
  }
  const lifetime: LifetimeStore = { version: 1, buckets: {} };
  for (const record of recent) addToLifetime(lifetime, record);
  return lifetime;
}

function cleanId(value: string | undefined): string | undefined {
  return value && value.length <= 256 ? value : undefined;
}

function addToLifetime(lifetime: LifetimeStore, record: GameStats): void {
  if (!record.won || !Number.isFinite(record.time)) return;
  const key = bucketKey(
    normalizeOrigin(record),
    record.difficulty,
    record.assistLevel,
  );
  let bucket = lifetime.buckets[key];
  if (!bucket) {
    bucket = { gamesPlayed: 0, totalTime: 0, bestTime: null };
    lifetime.buckets[key] = bucket;
  }
  bucket.gamesPlayed += 1;
  bucket.totalTime += record.time;
  if (!record.hintsUsed || record.hintsUsed === 0) {
    bucket.bestTime =
      bucket.bestTime === null
        ? record.time
        : Math.min(bucket.bestTime, record.time);
  }
}

function subtractFromLifetime(
  lifetime: LifetimeStore,
  record: GameStats,
  origin: GameOrigin,
): void {
  if (!record.won || !Number.isFinite(record.time)) return;
  const bucket =
    lifetime.buckets[bucketKey(origin, record.difficulty, record.assistLevel)];
  if (!bucket) return;
  bucket.gamesPlayed = Math.max(0, bucket.gamesPlayed - 1);
  bucket.totalTime = Math.max(0, bucket.totalTime - record.time);
  if (bucket.gamesPlayed === 0) {
    bucket.bestTime = null;
  } else if (bucket.bestTime === record.time) {
    // The retained history cannot recover an evicted legacy PB. Rebuilding
    // this one field from retained generated records is safer than keeping a
    // provenance record's time as the generated PB.
    bucket.bestTime = null;
  }
}

function summarize(
  lifetime: LifetimeStore,
  difficulty: Difficulty,
  assistLevel: AssistLevel | undefined,
  origin: GameOrigin,
): StatsSummary | null {
  const buckets = Object.entries(lifetime.buckets).filter(([key]) => {
    const [bucketOrigin, bucketDifficulty, bucketAssistLevel] =
      key.split("\u0000");
    return (
      bucketOrigin === origin &&
      bucketDifficulty === difficulty &&
      (assistLevel === undefined || bucketAssistLevel === assistLevel)
    );
  });
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

function bucketKey(
  origin: GameOrigin,
  difficulty: Difficulty,
  assistLevel: AssistLevel,
): string {
  return `${origin}\u0000${difficulty}\u0000${assistLevel}`;
}

function evictRecent(entries: GameStats[]): GameStats[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const key = bucketKey(
      normalizeOrigin(entry),
      entry.difficulty,
      entry.assistLevel,
    );
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const excess = new Map<string, number>();
  for (const [key, count] of counts) {
    if (count > MAX_RECENT_PER_BUCKET) {
      excess.set(key, count - MAX_RECENT_PER_BUCKET);
    }
  }
  if (excess.size === 0) return entries;
  return entries.filter((entry) => {
    const key = bucketKey(
      normalizeOrigin(entry),
      entry.difficulty,
      entry.assistLevel,
    );
    const over = excess.get(key) ?? 0;
    if (over === 0) return true;
    excess.set(key, over - 1);
    return false;
  });
}
