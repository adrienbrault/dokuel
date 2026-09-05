import {
  addLifetimeContribution,
  emptyLifetime,
  fitsRecentCaps,
} from "./multiplayer-stats-aggregate.ts";
import {
  ASSIST_LEVELS,
  BACKUP_RECORD_KEYS,
  DIFFICULTIES,
  type IndexedMatch,
  MAX_RECENT_RECORDS,
  type MultiplayerGameRecord,
  type MultiplayerLifetime,
  type MultiplayerLifetimeBucket,
  type MultiplayerStatsBackup,
  type MultiplayerStatsBackupRecord,
  type MultiplayerStatsStore,
  RECORD_KEYS,
} from "./multiplayer-stats-types.ts";
import type { AssistLevel, Difficulty } from "./types.ts";

export function validateMultiplayerStatsBackupValue(
  value: unknown,
): MultiplayerStatsBackup | null {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  if (!isRecord(parsed)) return null;
  if (
    parsed.version !== 1 ||
    !hasOnlyKeys(parsed, ["version", "recent", "lifetime"]) ||
    !Array.isArray(parsed.recent)
  ) {
    return null;
  }

  const recent = parsed.recent.flatMap((candidate) => {
    const record = validateBackupRecord(candidate);
    return record ? [record] : [];
  });
  if (
    recent.length !== parsed.recent.length ||
    recent.length > MAX_RECENT_RECORDS ||
    !fitsRecentCaps(recent)
  ) {
    return null;
  }

  const lifetime = validateLifetime(parsed.lifetime);
  if (!lifetime || !isConsistentWithRecent(lifetime, recent)) return null;
  return { version: 1, recent, lifetime };
}

export function validateMultiplayerStatsStore(
  value: unknown,
): MultiplayerStatsStore | null {
  if (!isRecord(value) || value.version !== 1) return null;
  if (
    !hasOnlyKeys(value, [
      "version",
      "recent",
      "lifetime",
      "matches",
      "indexComplete",
    ]) ||
    !Array.isArray(value.recent) ||
    !isRecord(value.matches) ||
    typeof value.indexComplete !== "boolean"
  ) {
    return null;
  }
  const recent = value.recent.flatMap((candidate) => {
    const record = validateStoredRecord(candidate);
    return record ? [record] : [];
  });
  if (
    recent.length !== value.recent.length ||
    recent.length > MAX_RECENT_RECORDS ||
    !fitsRecentCaps(recent)
  ) {
    return null;
  }
  const lifetime = validateLifetime(value.lifetime);
  if (!lifetime) return null;
  const matches: Record<string, IndexedMatch> = Object.create(null) as Record<
    string,
    IndexedMatch
  >;
  for (const [identity, candidate] of Object.entries(value.matches)) {
    if (!isIndexedMatch(candidate)) return null;
    matches[identity] = { ...candidate };
  }
  return {
    version: 1,
    recent,
    lifetime,
    matches,
    indexComplete: value.indexComplete,
  };
}

export function isMultiplayerGameRecord(
  value: unknown,
): value is MultiplayerGameRecord {
  if (!isRecord(value) || !hasOnlyKeys(value, RECORD_KEYS)) return false;
  const record = value as Partial<MultiplayerGameRecord>;
  return (
    isDifficulty(record.difficulty) &&
    isAssistLevel(record.assistLevel) &&
    isNonNegativeFinite(record.time) &&
    typeof record.date === "string" &&
    record.date.length <= 128 &&
    isNonNegativeFinite(record.timestamp) &&
    typeof record.won === "boolean" &&
    typeof record.opponentName === "string" &&
    record.opponentName.length <= 256 &&
    typeof record.roomId === "string" &&
    record.roomId.length > 0 &&
    record.roomId.length <= 256 &&
    typeof record.gameNumber === "number" &&
    Number.isSafeInteger(record.gameNumber) &&
    record.gameNumber >= 0
  );
}

function validateStoredRecord(value: unknown): MultiplayerGameRecord | null {
  if (!isMultiplayerGameRecord(value)) return null;
  return { ...value };
}

function validateBackupRecord(
  value: unknown,
): MultiplayerStatsBackupRecord | null {
  if (!isRecord(value) || !hasOnlyKeys(value, BACKUP_RECORD_KEYS)) return null;
  const record = value as Partial<MultiplayerStatsBackupRecord>;
  return isDifficulty(record.difficulty) &&
    isAssistLevel(record.assistLevel) &&
    isNonNegativeFinite(record.time) &&
    typeof record.date === "string" &&
    record.date.length <= 128 &&
    isNonNegativeFinite(record.timestamp) &&
    typeof record.won === "boolean" &&
    typeof record.opponentName === "string" &&
    record.opponentName.length <= 256
    ? {
        difficulty: record.difficulty,
        assistLevel: record.assistLevel,
        time: record.time,
        date: record.date,
        timestamp: record.timestamp,
        won: record.won,
        opponentName: record.opponentName,
      }
    : null;
}

function validateLifetime(value: unknown): MultiplayerLifetime | null {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.buckets)) {
    return null;
  }
  if (!Object.keys(value.buckets).every(isDifficulty)) return null;
  const buckets = emptyLifetime().buckets;
  for (const difficulty of DIFFICULTIES) {
    const candidate = value.buckets[difficulty];
    if (candidate === undefined) continue;
    if (!isLifetimeBucket(candidate)) return null;
    buckets[difficulty] = { ...candidate };
  }
  return { version: 1, buckets };
}

function isLifetimeBucket(value: unknown): value is MultiplayerLifetimeBucket {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["gamesPlayed", "wins", "totalTime", "bestWinTime"])
  ) {
    return false;
  }
  const bucket = value as Partial<MultiplayerLifetimeBucket>;
  return (
    typeof bucket.gamesPlayed === "number" &&
    Number.isSafeInteger(bucket.gamesPlayed) &&
    bucket.gamesPlayed >= 0 &&
    typeof bucket.wins === "number" &&
    Number.isSafeInteger(bucket.wins) &&
    bucket.wins >= 0 &&
    bucket.wins <= bucket.gamesPlayed &&
    isNonNegativeFinite(bucket.totalTime) &&
    (bucket.bestWinTime === null || isNonNegativeFinite(bucket.bestWinTime))
  );
}

function isIndexedMatch(value: unknown): value is IndexedMatch {
  if (!isRecord(value) || !hasOnlyKeys(value, ["difficulty", "time", "won"])) {
    return false;
  }
  const match = value as Partial<IndexedMatch>;
  return (
    isDifficulty(match.difficulty) &&
    isNonNegativeFinite(match.time) &&
    typeof match.won === "boolean"
  );
}

function isConsistentWithRecent(
  lifetime: MultiplayerLifetime,
  recent: readonly MultiplayerStatsBackupRecord[],
): boolean {
  const recentTotals = emptyLifetime().buckets;
  for (const record of recent) addLifetimeContribution(recentTotals, record);
  return DIFFICULTIES.every((difficulty) => {
    const total = lifetime.buckets[difficulty];
    const visible = recentTotals[difficulty];
    if (
      visible.gamesPlayed > total.gamesPlayed ||
      visible.wins > total.wins ||
      visible.totalTime > total.totalTime + Number.EPSILON
    ) {
      return false;
    }
    if (total.bestWinTime === null) return visible.wins === 0;
    return (
      visible.wins === 0 ||
      (visible.bestWinTime !== null && total.bestWinTime <= visible.bestWinTime)
    );
  });
}

function isDifficulty(value: unknown): value is Difficulty {
  return (
    typeof value === "string" && DIFFICULTIES.includes(value as Difficulty)
  );
}

function isAssistLevel(value: unknown): value is AssistLevel {
  return (
    typeof value === "string" && ASSIST_LEVELS.includes(value as AssistLevel)
  );
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
