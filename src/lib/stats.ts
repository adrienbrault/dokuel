import { getTodayISO } from "./format.ts";
import type { Difficulty } from "./types.ts";

export type GameStats = {
  difficulty: Difficulty;
  time: number;
  date: string;
  won: boolean;
  hintsUsed?: number;
};

const STORAGE_KEY = "sudoku_stats";

export function getStats(): GameStats[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveGameResult(
  difficulty: Difficulty,
  time: number,
  won: boolean,
  hintsUsed?: number,
) {
  const stats = getStats();
  stats.push({
    difficulty,
    time,
    date: getTodayISO(),
    won,
    hintsUsed: hintsUsed ?? 0,
  });
  // Keep last 100 games
  const trimmed = stats.slice(-100);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function getStatsForDifficulty(difficulty: Difficulty) {
  const stats = getStats().filter((s) => s.difficulty === difficulty && s.won);
  if (stats.length === 0) return null;
  const times = stats.map((s) => s.time);
  // Best time only counts games without hints
  const unhinted = stats
    .filter((s) => !s.hintsUsed || s.hintsUsed === 0)
    .map((s) => s.time);
  return {
    gamesPlayed: stats.length,
    bestTime: unhinted.length > 0 ? Math.min(...unhinted) : Math.min(...times),
    averageTime: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
  };
}

export function getRecentTimes(difficulty: Difficulty, limit = 10): number[] {
  const won = getStats().filter((s) => s.difficulty === difficulty && s.won);
  return won.slice(-limit).map((s) => s.time);
}

export function getImprovementDelta(difficulty: Difficulty): number | null {
  const times = getRecentTimes(difficulty, 2);
  if (times.length < 2) return null;
  return times[1]! - times[0]!;
}

export function getActivityDates(): Map<string, number> {
  const result = new Map<string, number>();
  for (const s of getStats()) {
    result.set(s.date, (result.get(s.date) ?? 0) + 1);
  }
  return result;
}

export function getCompletionRate(difficulty: Difficulty): {
  won: number;
  total: number;
  rate: number;
} {
  const all = getStats().filter((s) => s.difficulty === difficulty);
  const won = all.filter((s) => s.won).length;
  const total = all.length;
  return {
    won,
    total,
    rate: total > 0 ? Math.round((won / total) * 100) : 0,
  };
}
