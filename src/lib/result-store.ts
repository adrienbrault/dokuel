import { todayLocalISO } from "./date.ts";
import {
  bucketKey,
  evictRecent,
  summarize,
} from "./result-store-aggregates.ts";
import {
  migrateLegacyLifetime,
  normalizeLegacyRecords,
  normalizeOrigin,
  resolveOrigin,
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
  const previous =
    attemptId && Object.hasOwn(store.attempts, attemptId)
      ? store.attempts[attemptId]
      : undefined;
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
      persisted: true,
    };
  }

  const puzzleId = cleanId(input.metadata?.puzzleId);
  const origin = resolveOrigin(store, input.metadata?.origin, puzzleId);
  const record: GameStats = {
    difficulty: input.difficulty,
    assistLevel: input.assistLevel,
    time: input.time,
    date: input.metadata?.date ?? todayLocalISO(),
    won: input.won,
    hintsUsed: input.hintsUsed ?? 0,
    origin,
    ...(attemptId ? { attemptId } : {}),
    ...(puzzleId ? { puzzleId } : {}),
  };
  store.recent = evictRecent([...store.recent, record], MAX_RECENT_PER_BUCKET);
  addToLifetime(store.lifetime, record);
  if (attemptId) store.attempts[attemptId] = record;
  // Recent history, lifetime aggregates, and the attempt index share one
  // versioned envelope so a quota failure cannot persist only part of a win.
  const persisted = writeJson(RESULT_STORE_KEY, store);
  return {
    record,
    summary: summarize(
      store.lifetime,
      record.difficulty,
      record.assistLevel,
      normalizeOrigin(record),
    ),
    duplicate: false,
    persisted,
  };
}

export function getSummary(
  difficulty: Difficulty,
  assistLevel?: AssistLevel,
  origin: GameOrigin = "generated",
): StatsSummary | null {
  return summarize(loadStore().lifetime, difficulty, assistLevel, origin);
}

export function getLifetimeGamesPlayed(): number {
  return Object.values(loadStore().lifetime.buckets).reduce(
    (total, bucket) => total + bucket.gamesPlayed,
    0,
  );
}

export function getRecentResultsForOrigin(origin: GameOrigin): GameStats[] {
  return readRecentResults().filter(
    (record) => normalizeOrigin(record) === origin,
  );
}

/**
 * Return a detached, versioned snapshot suitable for a local backup.
 * Keeping the envelope shape here means callers do not need to know about
 * the legacy keys or the bounded recent-history implementation.
 */
export function exportResultStore(): ResultStore {
  return cloneStore(loadStore());
}

/** Validate a result-store backup without touching localStorage. */
export function validateResultStore(value: unknown): ResultStore | null {
  const candidate = typeof value === "string" ? parseJson(value) : value;
  const store = validateStore(candidate);
  return store ? cloneStore(store) : null;
}

/**
 * Replace the result envelope after validation. A failed setItem leaves the
 * old envelope untouched because localStorage writes replace one key at a
 * time.
 */
export function importResultStore(value: unknown): boolean {
  const store = validateResultStore(value);
  return store ? writeJson(RESULT_STORE_KEY, store) : false;
}

function loadStore(): ResultStore {
  const stored = readEnvelope();
  if (stored) return stored;
  const recent = normalizeLegacyRecords(readLegacyRaw());
  const lifetime = migrateLifetime(recent);
  const attempts: Record<string, GameStats> = Object.create(null) as Record<
    string,
    GameStats
  >;
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

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function cloneStore(store: ResultStore): ResultStore {
  const attempts: Record<string, GameStats> = Object.create(null) as Record<
    string,
    GameStats
  >;
  for (const [key, record] of Object.entries(store.attempts)) {
    attempts[key] = { ...record };
  }
  return {
    version: 1,
    recent: store.recent.map((record) => ({ ...record })),
    lifetime: {
      version: 1,
      buckets: Object.fromEntries(
        Object.entries(store.lifetime.buckets).map(([key, bucket]) => [
          key,
          { ...bucket },
        ]),
      ),
    },
    attempts,
  };
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
