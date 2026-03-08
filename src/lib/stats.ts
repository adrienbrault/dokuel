import type { Difficulty } from "./types.ts";

export type GameStats = {
  difficulty: Difficulty;
  time: number;
  date: string;
  won: boolean;
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
) {
  const stats = getStats();
  stats.push({
    difficulty,
    time,
    date: new Date().toISOString().slice(0, 10),
    won,
  });
  // Keep last 100 games
  const trimmed = stats.slice(-100);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function getStatsForDifficulty(difficulty: Difficulty) {
  const stats = getStats().filter((s) => s.difficulty === difficulty && s.won);
  if (stats.length === 0) return null;
  const times = stats.map((s) => s.time);
  return {
    gamesPlayed: stats.length,
    bestTime: Math.min(...times),
    averageTime: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
  };
}
