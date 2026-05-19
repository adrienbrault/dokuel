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

export function getStatsForDifficulty(
  difficulty: Difficulty,
  assistLevel?: AssistLevel,
) {
  const stats = getStats().filter(
    (s) =>
      s.difficulty === difficulty &&
      s.won &&
      (assistLevel === undefined || s.assistLevel === assistLevel),
  );
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

const ASSIST_LEVELS: readonly AssistLevel[] = ["paper", "standard", "full"];

export type AssistLevelStats = {
  assistLevel: AssistLevel;
  gamesPlayed: number;
  bestTime: number;
  averageTime: number;
};

/**
 * Per-assist-mode win stats for a difficulty, in paper/standard/full
 * order. Modes with no win are omitted so callers render only the
 * rows that have data.
 */
export function getStatsByAssistLevel(
  difficulty: Difficulty,
): AssistLevelStats[] {
  return ASSIST_LEVELS.flatMap((level) => {
    const stats = getStatsForDifficulty(difficulty, level);
    return stats ? [{ assistLevel: level, ...stats }] : [];
  });
}
