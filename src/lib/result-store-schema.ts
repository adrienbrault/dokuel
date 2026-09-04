import type {
  GameOrigin,
  GameStats,
  LifetimeBucket,
  LifetimeStore,
  ResultStore,
} from "./result-store-types.ts";
import type { AssistLevel, Difficulty } from "./types.ts";

const ORIGINS: readonly GameOrigin[] = [
  "generated",
  "daily",
  "friend",
  "imported",
  "replay",
];
const DIFFICULTIES: readonly Difficulty[] = [
  "easy",
  "medium",
  "hard",
  "expert",
];
const ASSIST_LEVELS: readonly AssistLevel[] = ["paper", "standard", "full"];

export function normalizeLegacyRecords(value: unknown): GameStats[] {
  return Array.isArray(value) ? normalizeRecords(value) : [];
}

export function normalizeRecords(records: readonly unknown[]): GameStats[] {
  return records.flatMap((value) => {
    if (!isGameStats(value)) return [];
    const record = value as GameStats;
    return [
      {
        ...record,
        assistLevel: record.assistLevel ?? "standard",
        origin: normalizeOrigin(record),
      },
    ];
  });
}

export function normalizeOrigin(record: GameStats): GameOrigin {
  return isOrigin(record.origin) ? record.origin : "generated";
}

export function validateStore(value: unknown): ResultStore | null {
  if (!isRecord(value)) return null;
  const candidate = value as Partial<ResultStore>;
  if (
    candidate.version !== 1 ||
    !Array.isArray(candidate.recent) ||
    !isLifetimeStore(candidate.lifetime) ||
    !isRecord(candidate.attempts)
  ) {
    return null;
  }
  if (!candidate.recent.every(isGameStats)) return null;
  const attempts: Record<string, GameStats> = {};
  for (const [key, valueForKey] of Object.entries(candidate.attempts)) {
    if (!isGameStats(valueForKey)) return null;
    const [record] = normalizeRecords([valueForKey]);
    if (!record) return null;
    attempts[key] = record;
  }
  return {
    version: 1,
    recent: normalizeRecords(candidate.recent),
    lifetime: candidate.lifetime,
    attempts,
  };
}

export function migrateLegacyLifetime(value: unknown): LifetimeStore | null {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.buckets)) {
    return null;
  }
  const buckets: Record<string, LifetimeBucket> = {};
  for (const [key, valueForKey] of Object.entries(value.buckets)) {
    if (!isLifetimeBucket(valueForKey)) return null;
    const [difficulty, assistLevel] = key.split("\u0000");
    if (
      !DIFFICULTIES.includes(difficulty as Difficulty) ||
      !ASSIST_LEVELS.includes(assistLevel as AssistLevel)
    ) {
      return null;
    }
    buckets[`${difficulty}\u0000${assistLevel}`] = valueForKey;
  }
  return { version: 1, buckets };
}

export function isGameStats(value: unknown): value is GameStats {
  if (!isRecord(value)) return false;
  const record = value as Partial<GameStats>;
  return (
    DIFFICULTIES.includes(record.difficulty as Difficulty) &&
    (record.assistLevel === undefined ||
      ASSIST_LEVELS.includes(record.assistLevel as AssistLevel)) &&
    typeof record.time === "number" &&
    Number.isFinite(record.time) &&
    typeof record.date === "string" &&
    typeof record.won === "boolean" &&
    (record.hintsUsed === undefined ||
      (typeof record.hintsUsed === "number" &&
        Number.isFinite(record.hintsUsed))) &&
    (record.origin === undefined || isOrigin(record.origin)) &&
    (record.attemptId === undefined || typeof record.attemptId === "string") &&
    (record.puzzleId === undefined || typeof record.puzzleId === "string")
  );
}

function isOrigin(value: unknown): value is GameOrigin {
  return typeof value === "string" && ORIGINS.includes(value as GameOrigin);
}

function isLifetimeStore(value: unknown): value is LifetimeStore {
  if (!isRecord(value)) return false;
  const candidate = value as Partial<LifetimeStore>;
  return (
    candidate.version === 1 &&
    isRecord(candidate.buckets) &&
    Object.values(candidate.buckets).every(isLifetimeBucket)
  );
}

function isLifetimeBucket(value: unknown): value is LifetimeBucket {
  if (!isRecord(value)) return false;
  const bucket = value as Partial<LifetimeBucket>;
  return (
    typeof bucket.gamesPlayed === "number" &&
    Number.isSafeInteger(bucket.gamesPlayed) &&
    bucket.gamesPlayed >= 0 &&
    typeof bucket.totalTime === "number" &&
    Number.isFinite(bucket.totalTime) &&
    (bucket.bestTime === null ||
      (typeof bucket.bestTime === "number" && Number.isFinite(bucket.bestTime)))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
