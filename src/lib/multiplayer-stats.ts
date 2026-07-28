import { readJson, writeJson } from "./storage.ts";
import type { AssistLevel, Difficulty } from "./types.ts";

export type MultiplayerGameRecord = {
  difficulty: Difficulty;
  assistLevel: AssistLevel;
  time: number;
  date: string;
  timestamp: number;
  won: boolean;
  opponentName: string;
  roomId: string;
  gameNumber: number;
};

const STORAGE_KEY = "sudoku_multiplayer_stats";

// Per-difficulty cap: a global ring let a run of medium matches evict
// an easy best-win record (getMultiplayerStatsForDifficulty derives
// bestWinTime from stored records).
const MAX_RECORDS_PER_DIFFICULTY = 100;

export function getMultiplayerStats(): MultiplayerGameRecord[] {
  // Callers iterate immediately; a parseable non-array ("{}", "null")
  // must not escape this reader.
  return readJson<MultiplayerGameRecord[]>(STORAGE_KEY, [], (parsed) =>
    Array.isArray(parsed) ? (parsed as MultiplayerGameRecord[]) : null,
  );
}

export function saveMultiplayerGameResult(record: MultiplayerGameRecord) {
  const all = getMultiplayerStats();
  const existingIndex = all.findIndex(
    (r) => r.roomId === record.roomId && r.gameNumber === record.gameNumber,
  );
  if (existingIndex !== -1) {
    // Same game reported again. Identical outcome → true duplicate
    // (remount), keep the original. Different outcome → a photo-finish
    // whose CRDT merge settled the other way after we recorded
    // optimistically; the correction wins.
    if (all[existingIndex]!.won === record.won) return;
    const corrected = [...all];
    corrected[existingIndex] = record;
    writeJson(STORAGE_KEY, corrected);
    return;
  }
  const next = [...all, record];
  const counts = new Map<string, number>();
  for (const r of next) {
    counts.set(r.difficulty, (counts.get(r.difficulty) ?? 0) + 1);
  }
  const excess = new Map<string, number>();
  for (const [difficulty, count] of counts) {
    if (count > MAX_RECORDS_PER_DIFFICULTY) {
      excess.set(difficulty, count - MAX_RECORDS_PER_DIFFICULTY);
    }
  }
  const trimmed =
    excess.size === 0
      ? next
      : next.filter((r) => {
          const over = excess.get(r.difficulty) ?? 0;
          if (over === 0) return true;
          excess.set(r.difficulty, over - 1);
          return false;
        });
  writeJson(STORAGE_KEY, trimmed);
}

export type MultiplayerSummary = {
  played: number;
  wins: number;
  losses: number;
  winRate: number;
};

export function getMultiplayerSummary(): MultiplayerSummary {
  const all = getMultiplayerStats();
  const wins = all.filter((r) => r.won).length;
  const played = all.length;
  return {
    played,
    wins,
    losses: played - wins,
    winRate: played === 0 ? 0 : wins / played,
  };
}

export type MultiplayerDifficultyStats = {
  played: number;
  wins: number;
  losses: number;
  winRate: number;
  bestWinTime: number | null;
};

export function getMultiplayerStatsForDifficulty(
  difficulty: Difficulty,
): MultiplayerDifficultyStats | null {
  const games = getMultiplayerStats().filter(
    (r) => r.difficulty === difficulty,
  );
  if (games.length === 0) return null;
  const wins = games.filter((r) => r.won);
  const bestWinTime =
    wins.length > 0 ? Math.min(...wins.map((r) => r.time)) : null;
  return {
    played: games.length,
    wins: wins.length,
    losses: games.length - wins.length,
    winRate: wins.length / games.length,
    bestWinTime,
  };
}
