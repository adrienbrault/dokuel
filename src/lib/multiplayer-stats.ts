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

const MAX_RECORDS = 100;

export function getMultiplayerStats(): MultiplayerGameRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // Callers iterate immediately; a parseable non-array ("{}", "null")
    // must not escape this reader.
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(corrected));
    return;
  }
  const next = [...all, record].slice(-MAX_RECORDS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
