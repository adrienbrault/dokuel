import { todayLocalISO } from "./date.ts";
import { generatePuzzleWithSolution } from "./sudoku.ts";
import type { Difficulty } from "./types.ts";

/** Deterministic 32-bit string hash — the seed source for seededRandom. */
export function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/**
 * Deterministic integer LCG → [0,1) float. Exported as the app's one
 * seeded Rng so tests exercise the exact generator the daily golden
 * vectors pin — a copied implementation could drift silently.
 */
export function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    return (state >>> 0) / 0x100000000;
  };
}

export function getDailyPuzzle(
  date: string = todayLocalISO(),
  difficulty: Difficulty = "medium",
): { puzzle: string; solution: string; date: string } {
  const seed = hashCode(`sudoku-daily-${date}-${difficulty}`);
  const rng = seededRandom(seed);
  const { puzzle, solution } = generatePuzzleWithSolution(difficulty, rng);
  return { puzzle, solution, date };
}

/**
 * The daily board for a date, preferring the frozen table over the
 * generator so a date already played can never change under a player.
 *
 * Async because the table is a dynamic import: 60 KB of boards has no
 * business in the entry chunk that solo and multiplayer players
 * download. The caller derives the solution with solvePuzzle, exactly
 * as it already does for any supplied puzzle.
 */
export async function getDailyPuzzleFor(
  date: string = todayLocalISO(),
): Promise<{ puzzle: string; date: string }> {
  const frozen = await frozenPuzzle(date);
  if (frozen) return { puzzle: frozen, date };
  return { puzzle: getDailyPuzzle(date, "medium").puzzle, date };
}

async function frozenPuzzle(date: string): Promise<string | null> {
  try {
    const { default: table } = await import("./dailies.json");
    return (table as Record<string, string>)[date] ?? null;
  } catch {
    // Chunk unreachable (offline, a deploy that moved it). The
    // generator still reproduces these boards today, so a fallback is
    // better than a screen that never loads.
    return null;
  }
}
