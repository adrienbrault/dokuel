import { parsePuzzle } from "../sudoku.ts";
import type { Board } from "../types.ts";
import type { Demo, DemoStep } from "./types.ts";

/**
 * Build a Board ready to render for a given demo step. Givens come from
 * the puzzle string. The step's placements layer on top as non-given
 * filled cells. Remaining empty cells receive their candidate set as
 * notes — from the step's own snapshot if present, otherwise from the
 * demo's initialCandidates.
 */
export function applyStepToBoard(demo: Demo, step: DemoStep): Board {
  const board = parsePuzzle(demo.puzzle);
  if (step.placements) {
    for (const [key, value] of step.placements) {
      const row = Math.floor(key / 9);
      const col = key % 9;
      const cell = board[row]![col]!;
      cell.value = value;
      cell.isGiven = false;
      cell.notes = new Set();
    }
  }
  const candidates = step.candidates ?? demo.initialCandidates;
  for (const [key, digits] of candidates) {
    const row = Math.floor(key / 9);
    const col = key % 9;
    const cell = board[row]![col]!;
    if (cell.value === null) {
      cell.notes = new Set(digits);
    }
  }
  return board;
}
