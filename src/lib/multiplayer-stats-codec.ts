import {
  emptyLifetime,
  rebuildLifetime,
  trimRecent,
} from "./multiplayer-stats-aggregate.ts";
import type {
  IndexedMatch,
  MultiplayerGameRecord,
  MultiplayerStatsBackupRecord,
  MultiplayerStatsStore,
} from "./multiplayer-stats-types.ts";
import {
  isMultiplayerGameRecord,
  validateMultiplayerStatsStore,
} from "./multiplayer-stats-validation.ts";
import { readJson, writeJson } from "./storage.ts";

export const MULTIPLAYER_STATS_STORAGE_KEY = "sudoku_multiplayer_stats";

export function loadMultiplayerStatsStore(): MultiplayerStatsStore {
  const raw = readJson<unknown>(
    MULTIPLAYER_STATS_STORAGE_KEY,
    undefined,
    (value) => value,
  );
  const stored = validateMultiplayerStatsStore(raw);
  if (stored) {
    return stored.indexComplete
      ? { ...stored, lifetime: rebuildLifetime(stored.matches) }
      : stored;
  }
  if (Array.isArray(raw)) return migrateLegacyRecords(raw);
  return emptyStore();
}

export function writeMultiplayerStatsStore(
  store: MultiplayerStatsStore,
): boolean {
  return writeJson(MULTIPLAYER_STATS_STORAGE_KEY, store);
}

export function toBackupRecord(
  record: MultiplayerGameRecord,
): MultiplayerStatsBackupRecord {
  return {
    difficulty: record.difficulty,
    assistLevel: record.assistLevel,
    time: record.time,
    date: record.date,
    timestamp: record.timestamp,
    won: record.won,
    opponentName: record.opponentName,
  };
}

export function toStoredRecord(
  record: MultiplayerStatsBackupRecord,
  index: number,
): MultiplayerGameRecord {
  return {
    ...record,
    roomId: `imported-${index}-${record.timestamp}`,
    gameNumber: index,
  };
}

function migrateLegacyRecords(raw: unknown[]): MultiplayerStatsStore {
  const all = raw.flatMap((candidate) => {
    const record = isMultiplayerGameRecord(candidate) ? { ...candidate } : null;
    return record ? [record] : [];
  });
  const matches: Record<string, IndexedMatch> = Object.create(null) as Record<
    string,
    IndexedMatch
  >;
  for (const record of all) {
    matches[matchIdentity(record.roomId, record.gameNumber)] =
      toIndexedMatch(record);
  }
  return {
    version: 1,
    recent: trimRecent(all),
    lifetime: rebuildLifetime(matches),
    matches,
    indexComplete: true,
  };
}

function emptyStore(): MultiplayerStatsStore {
  return {
    version: 1,
    recent: [],
    lifetime: emptyLifetime(),
    matches: Object.create(null) as Record<string, IndexedMatch>,
    indexComplete: true,
  };
}

function toIndexedMatch(record: MultiplayerGameRecord): IndexedMatch {
  return {
    difficulty: record.difficulty,
    time: record.time,
    won: record.won,
  };
}

function matchIdentity(roomId: string, gameNumber: number): string {
  return `${roomId}\u0000${gameNumber}`;
}
