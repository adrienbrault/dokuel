import { generatePuzzle, solvePuzzle } from "./sudoku.ts";
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
  date: string = new Date().toISOString().slice(0, 10),
  difficulty: Difficulty = "medium",
): { puzzle: string; solution: string; date: string } {
  const seed = hashCode(`sudoku-daily-${date}-${difficulty}`);
  const rng = seededRandom(seed);

  // Override Math.random temporarily for deterministic generation
  const originalRandom = Math.random;
  Math.random = rng;
  try {
    const puzzle = generatePuzzle(difficulty);
    const solution = solvePuzzle(puzzle);
    return { puzzle, solution, date };
  } finally {
    Math.random = originalRandom;
  }
}
