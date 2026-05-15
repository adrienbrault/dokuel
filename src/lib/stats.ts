import { readJson, writeJson } from "./storage.ts";
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
  return readJson<GameStats[]>(STORAGE_KEY, []);
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
    date: new Date().toISOString().slice(0, 10),
    won,
    hintsUsed: hintsUsed ?? 0,
  });
  // Keep last 100 games
  writeJson(STORAGE_KEY, stats.slice(-100));
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
