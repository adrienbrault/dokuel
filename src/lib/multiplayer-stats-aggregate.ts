import {
  DIFFICULTIES,
  type IndexedMatch,
  MAX_RECORDS_PER_DIFFICULTY,
  type MultiplayerGameRecord,
  type MultiplayerLifetime,
  type MultiplayerLifetimeBucket,
} from "./multiplayer-stats-types.ts";
import type { Difficulty } from "./types.ts";

export function addLifetimeContribution(
  lifetime: MultiplayerLifetime | MultiplayerLifetime["buckets"],
  record: Pick<MultiplayerGameRecord, "difficulty" | "time" | "won">,
): void {
  const buckets = "buckets" in lifetime ? lifetime.buckets : lifetime;
  const bucket = buckets[record.difficulty];
  bucket.gamesPlayed += 1;
  bucket.totalTime += record.time;
  if (!record.won) return;
  bucket.wins += 1;
  bucket.bestWinTime =
    bucket.bestWinTime === null
      ? record.time
      : Math.min(bucket.bestWinTime, record.time);
}

export function replaceLifetimeContribution(
  lifetime: MultiplayerLifetime,
  previous: IndexedMatch,
  replacement: Pick<MultiplayerGameRecord, "difficulty" | "time" | "won">,
): void {
  const previousBucket = lifetime.buckets[previous.difficulty];
  previousBucket.gamesPlayed = Math.max(0, previousBucket.gamesPlayed - 1);
  previousBucket.totalTime = Math.max(
    0,
    previousBucket.totalTime - previous.time,
  );
  if (previous.won) {
    previousBucket.wins = Math.max(0, previousBucket.wins - 1);
  }
  if (previousBucket.gamesPlayed === 0 || previousBucket.wins === 0) {
    previousBucket.bestWinTime = null;
  } else if (previousBucket.bestWinTime === previous.time) {
    previousBucket.bestWinTime = null;
  }
  addLifetimeContribution(lifetime, replacement);
}

export function rebuildLifetime(
  matches: Record<string, IndexedMatch>,
): MultiplayerLifetime {
  const lifetime = emptyLifetime();
  for (const match of Object.values(matches)) {
    addLifetimeContribution(lifetime, match);
  }
  return lifetime;
}

export function emptyLifetime(): MultiplayerLifetime {
  return {
    version: 1,
    buckets: {
      easy: emptyBucket(),
      medium: emptyBucket(),
      hard: emptyBucket(),
      expert: emptyBucket(),
    },
  };
}

export function emptyBucket(): MultiplayerLifetimeBucket {
  return {
    gamesPlayed: 0,
    wins: 0,
    totalTime: 0,
    bestWinTime: null,
  };
}

export function cloneLifetime(
  lifetime: MultiplayerLifetime,
): MultiplayerLifetime {
  return {
    version: 1,
    buckets: {
      easy: { ...lifetime.buckets.easy },
      medium: { ...lifetime.buckets.medium },
      hard: { ...lifetime.buckets.hard },
      expert: { ...lifetime.buckets.expert },
    },
  };
}

export function appendRecent(
  recent: readonly MultiplayerGameRecord[],
  record: MultiplayerGameRecord,
): MultiplayerGameRecord[] {
  return trimRecent([...recent, cloneRecord(record)]);
}

export function replaceOrAppendRecent(
  recent: readonly MultiplayerGameRecord[],
  record: MultiplayerGameRecord,
  identity: (candidate: MultiplayerGameRecord) => string,
): MultiplayerGameRecord[] {
  const recordIdentity = identity(record);
  const index = recent.findIndex(
    (candidate) => identity(candidate) === recordIdentity,
  );
  if (index === -1) return appendRecent(recent, record);
  const replaced = recent.map((candidate, candidateIndex) =>
    candidateIndex === index ? cloneRecord(record) : cloneRecord(candidate),
  );
  return trimRecent(replaced);
}

export function trimRecent(
  records: readonly MultiplayerGameRecord[],
): MultiplayerGameRecord[] {
  const counts = new Map<Difficulty, number>();
  const excess = new Map<Difficulty, number>();
  for (const record of records) {
    counts.set(record.difficulty, (counts.get(record.difficulty) ?? 0) + 1);
  }
  for (const [difficulty, count] of counts) {
    if (count > MAX_RECORDS_PER_DIFFICULTY) {
      excess.set(difficulty, count - MAX_RECORDS_PER_DIFFICULTY);
    }
  }
  if (excess.size === 0) return records.map(cloneRecord);
  return records.flatMap((record) => {
    const remaining = excess.get(record.difficulty) ?? 0;
    if (remaining === 0) return [cloneRecord(record)];
    excess.set(record.difficulty, remaining - 1);
    return [];
  });
}

export function fitsRecentCaps(
  records: readonly Pick<MultiplayerGameRecord, "difficulty">[],
): boolean {
  return DIFFICULTIES.every(
    (difficulty) =>
      records.filter((record) => record.difficulty === difficulty).length <=
      MAX_RECORDS_PER_DIFFICULTY,
  );
}

function cloneRecord(record: MultiplayerGameRecord): MultiplayerGameRecord {
  return { ...record };
}
