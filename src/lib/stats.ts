import { STORAGE_KEYS } from "./constants.ts";
import { getTodayISO } from "./format.ts";
import type { Difficulty } from "./types.ts";

export type GameStats = {
  difficulty: Difficulty;
  time: number;
  date: string;
  won: boolean;
  hintsUsed?: number;
};

const STORAGE_KEY = STORAGE_KEYS.STATS;

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
