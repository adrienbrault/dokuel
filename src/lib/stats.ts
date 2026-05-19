import type { AssistLevel, Difficulty } from "./types.ts";

export type GameStats = {
  difficulty: Difficulty;
  assistLevel: AssistLevel;
  time: number;
  date: string;
  won: boolean;
  hintsUsed?: number;
};

const STORAGE_KEY = "sudoku_stats";

export function getStats(): GameStats[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GameStats[];
    // Entries saved before assist-level tracking default to "standard",
    // the only mode the game offered at the time.
    return parsed.map((s) => ({
      ...s,
      assistLevel: s.assistLevel ?? "standard",
    }));
  } catch {
    return [];
  }
}

export function saveGameResult(
  difficulty: Difficulty,
  assistLevel: AssistLevel,
  time: number,
  won: boolean,
  hintsUsed?: number,
) {
  const stats = getStats();
  stats.push({
    difficulty,
    assistLevel,
    time,
    date: new Date().toISOString().slice(0, 10),
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
