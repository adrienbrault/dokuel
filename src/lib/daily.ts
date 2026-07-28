import { todayLocalISO } from "./date.ts";
import { generatePuzzleWithSolution } from "./sudoku.ts";
import type { Difficulty } from "./types.ts";

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
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
