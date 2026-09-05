import { normalizeOrigin } from "./result-store-schema.ts";
import type {
  GameOrigin,
  GameStats,
  LifetimeStore,
  StatsSummary,
} from "./result-store-types.ts";
import type { AssistLevel, Difficulty } from "./types.ts";

export function bucketKey(
  origin: GameOrigin,
  difficulty: Difficulty,
  assistLevel: AssistLevel,
): string {
  return `${origin}\u0000${difficulty}\u0000${assistLevel}`;
}

export function summarize(
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

export function evictRecent(
  entries: GameStats[],
  maxPerBucket: number,
): GameStats[] {
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
    if (count > maxPerBucket) excess.set(key, count - maxPerBucket);
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
