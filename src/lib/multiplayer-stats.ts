import {
  addLifetimeContribution,
  appendRecent,
  cloneLifetime,
  rebuildLifetime,
  replaceLifetimeContribution,
  replaceOrAppendRecent,
} from "./multiplayer-stats-aggregate.ts";
import {
  loadMultiplayerStatsStore,
  toBackupRecord,
  toStoredRecord,
  writeMultiplayerStatsStore,
} from "./multiplayer-stats-codec.ts";
import type {
  IndexedMatch,
  MultiplayerDifficultyStats,
  MultiplayerGameRecord,
  MultiplayerStatsBackup,
  MultiplayerStatsStore,
  MultiplayerSummary,
} from "./multiplayer-stats-types.ts";
import { DIFFICULTIES } from "./multiplayer-stats-types.ts";
import {
  isMultiplayerGameRecord,
  validateMultiplayerStatsBackupValue,
} from "./multiplayer-stats-validation.ts";

export type {
  MultiplayerDifficultyStats,
  MultiplayerGameRecord,
  MultiplayerLifetime,
  MultiplayerLifetimeBucket,
  MultiplayerStatsBackup,
  MultiplayerStatsBackupRecord,
  MultiplayerSummary,
} from "./multiplayer-stats-types.ts";

export function getMultiplayerStats(): MultiplayerGameRecord[] {
  // Return a detached list so a screen cannot mutate the persisted view in
  // memory between writes.
  return loadMultiplayerStatsStore().recent.map(cloneRecord);
}

export function saveMultiplayerGameResult(record: MultiplayerGameRecord): void {
  if (!isMultiplayerGameRecord(record)) return;

  const store = loadMultiplayerStatsStore();
  const identity = matchIdentity(record.roomId, record.gameNumber);
  const previous = store.matches[identity];
  if (previous) {
    // A remount can report the same result twice. Preserve the first timing
    // and metadata. A different winner is a photo-finish correction, even
    // when its earlier row has already been evicted from recent history.
    if (previous.won === record.won) return;

    store.matches[identity] = toIndexedMatch(record);
    if (store.indexComplete) {
      store.lifetime = rebuildLifetime(store.matches);
    } else {
      replaceLifetimeContribution(store.lifetime, previous, record);
    }
    store.recent = replaceOrAppendRecent(
      store.recent,
      record,
      matchIdentityForRecord,
    );
    writeMultiplayerStatsStore(store);
    return;
  }

  store.matches[identity] = toIndexedMatch(record);
  addLifetimeContribution(store.lifetime, record);
  store.recent = appendRecent(store.recent, record);
  writeMultiplayerStatsStore(store);
}

export function getMultiplayerSummary(): MultiplayerSummary {
  const lifetime = loadMultiplayerStatsStore().lifetime;
  const totals = DIFFICULTIES.reduce(
    (summary, difficulty) => {
      const bucket = lifetime.buckets[difficulty];
      summary.played += bucket.gamesPlayed;
      summary.wins += bucket.wins;
      return summary;
    },
    { played: 0, wins: 0 },
  );
  return {
    played: totals.played,
    wins: totals.wins,
    losses: totals.played - totals.wins,
    winRate: totals.played === 0 ? 0 : totals.wins / totals.played,
  };
}

export function getMultiplayerStatsForDifficulty(
  difficulty: MultiplayerGameRecord["difficulty"],
): MultiplayerDifficultyStats | null {
  const bucket = loadMultiplayerStatsStore().lifetime.buckets[difficulty];
  if (bucket.gamesPlayed === 0) return null;
  return {
    played: bucket.gamesPlayed,
    wins: bucket.wins,
    losses: bucket.gamesPlayed - bucket.wins,
    winRate: bucket.wins / bucket.gamesPlayed,
    bestWinTime: bucket.bestWinTime,
  };
}

/** Return a detached, versioned result snapshot suitable for a local backup. */
export function exportMultiplayerStats(): MultiplayerStatsBackup {
  const store = loadMultiplayerStatsStore();
  return {
    version: 1,
    recent: store.recent.map(toBackupRecord),
    lifetime: cloneLifetime(store.lifetime),
  };
}

/** Validate portable multiplayer results without touching localStorage. */
export function validateMultiplayerStatsBackup(
  value: unknown,
): MultiplayerStatsBackup | null {
  return validateMultiplayerStatsBackupValue(value);
}

/** Replace portable multiplayer result data after the caller confirms it. */
export function importMultiplayerStats(value: unknown): boolean {
  const backup = validateMultiplayerStatsBackupValue(value);
  if (!backup) return false;

  const recent: MultiplayerGameRecord[] = [];
  const matches: Record<string, IndexedMatch> = Object.create(null) as Record<
    string,
    IndexedMatch
  >;
  for (const [index, record] of backup.recent.entries()) {
    const localRecord = toStoredRecord(record, index);
    recent.push(localRecord);
    matches[matchIdentity(localRecord.roomId, localRecord.gameNumber)] =
      toIndexedMatch(localRecord);
  }

  const store: MultiplayerStatsStore = {
    version: 1,
    recent,
    lifetime: cloneLifetime(backup.lifetime),
    matches,
    indexComplete: false,
  };
  return writeMultiplayerStatsStore(store);
}

// These aliases keep the API discoverable for callers that refer to results
// rather than stats while preserving one implementation and schema.
export const exportMultiplayerResults = exportMultiplayerStats;
export const validateMultiplayerResultsBackup = validateMultiplayerStatsBackup;
export const importMultiplayerResults = importMultiplayerStats;

function toIndexedMatch(record: MultiplayerGameRecord): IndexedMatch {
  return {
    difficulty: record.difficulty,
    time: record.time,
    won: record.won,
  };
}

function matchIdentityForRecord(record: MultiplayerGameRecord): string {
  return matchIdentity(record.roomId, record.gameNumber);
}

function matchIdentity(roomId: string, gameNumber: number): string {
  return `${roomId}\u0000${gameNumber}`;
}

function cloneRecord(record: MultiplayerGameRecord): MultiplayerGameRecord {
  return { ...record };
}
