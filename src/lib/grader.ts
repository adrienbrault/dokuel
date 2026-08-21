/**
 * Human-technique sudoku grader. Solves with the deductions a player can
 * actually execute and reports the hardest tier the puzzle demanded.
 * Same 81-char board format as the solver; the techniques it may use,
 * their order and their tiers all come from the ladder.
 */

import { findSingle, initCandidates, place } from "./candidates.ts";
import { LADDER, type TechniqueTier } from "./ladder.ts";

export type PuzzleGrade = {
  tier: TechniqueTier;
  /**
   * Empty cells left when tier ≤3 techniques exhaust — 0 when they solve
   * the puzzle, larger when more of the board resists everything short
   * of chains or guessing.
   */
  stuckCells: number;
};

/**
 * Grade a puzzle by the hardest technique required to finish it. A
 * malformed or internally contradictory puzzle grades as maximally
 * stuck — nothing a human technique could do with it.
 */
export function gradePuzzle(puzzle: string): PuzzleGrade {
  const s = initCandidates(puzzle);
  if (!s) return { tier: 5, stuckCells: 81 };
  let tier: TechniqueTier = 1;
  while (s.empty > 0) {
    const single = findSingle(s);
    if (single) {
      place(s, single.cell, single.digit);
      continue;
    }
    // Cheapest rung that applies wins — a scan that fires has already
    // applied its eliminations, so the walk stops at the first one. The
    // tier a puzzle earns is the hardest step it ever forced, never a
    // harder one it merely allows.
    let applied: TechniqueTier | null = null;
    for (const rung of LADDER) {
      if (rung.scan(s)) {
        applied = rung.tier;
        break;
      }
    }
    if (applied === null) return { tier: 5, stuckCells: s.empty };
    tier = tier < applied ? applied : tier;
  }
  return { tier, stuckCells: 0 };
}
