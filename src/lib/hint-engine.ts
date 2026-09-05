import {
  candidatesAt,
  eliminatingCells,
  findHiddenSingle,
  findNakedSingle,
  nakedSingleAt,
} from "./singles.ts";
import { getErrors } from "./sudoku.ts";
import { findTechniqueHint } from "./technique-hint.ts";
import type { ActiveHint, Board, EliminationHint, Position } from "./types.ts";

// Alias, not a parallel definition: board-engine stores findHint's
// result in an ActiveHint field, and two structurally-identical types
// only stay identical by luck.
export type HintExplanation = ActiveHint;

/** The unit that already holds `digit`, and the cell proving it. */
function noteConflictIn(
  board: Board,
  row: number,
  col: number,
  digit: number,
): { unit: string; proof: Position } | null {
  for (let c = 0; c < 9; c++) {
    if (c !== col && board[row]![c]!.value === digit) {
      return { unit: `row ${row + 1}`, proof: { row, col: c } };
    }
  }
  for (let r = 0; r < 9; r++) {
    if (r !== row && board[r]![col]!.value === digit) {
      return { unit: `column ${col + 1}`, proof: { row: r, col } };
    }
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if ((r !== row || c !== col) && board[r]![c]!.value === digit) {
        const box = Math.floor(row / 3) * 3 + Math.floor(col / 3) + 1;
        return { unit: `box ${box}`, proof: { row: r, col: c } };
      }
    }
  }
  return null;
}

/**
 * A pencilled digit that one of the cell's own peers already holds.
 * The player wrote it before the peer was placed, or simply misread
 * the grid; either way every deduction they make from it is poisoned,
 * so it is worth more than any technique the ladder could teach next.
 */
function findImpossibleNote(board: Board): EliminationHint | null {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const cell = board[row]![col]!;
      if (cell.value !== null) continue;
      for (const digit of [...cell.notes].sort((a, b) => a - b)) {
        const conflict = noteConflictIn(board, row, col, digit);
        if (!conflict) continue;
        return {
          kind: "elimination",
          position: { row, col },
          technique: "note-conflict",
          explanation: `The ${digit} pencilled in r${row + 1}c${col + 1} already sits in ${conflict.unit}, so rub it out.`,
          digits: [digit],
          eliminatedCells: [{ row, col }],
          relatedCells: [conflict.proof],
        };
      }
    }
  }
  return null;
}

/**
 * Find the best hint for the current board state.
 * Tries techniques in order of simplicity:
 * 1. Naked single (only one candidate possible)
 * 2. Hidden single (value can only go in one place in a group)
 * Falls back to solution if no logical deduction found.
 *
 * When `selectedCell` is provided and it has a naked single, it wins
 * over any other naked single elsewhere on the board.
 */
export function findHint(
  board: Board,
  solution: string,
  selectedCell?: Position | null,
): HintExplanation | null {
  // A wrong entry poisons every deduction below it: singles derived
  // from a false premise recommend provably wrong digits with full
  // confidence. Surface the mistake first — on a mistake-free board,
  // every single the scans find necessarily matches the solution.
  const errors = getErrors(board, solution);
  if (errors.size > 0) {
    const key = Math.min(...errors);
    const row = Math.floor(key / 9);
    const col = key % 9;
    const wrongValue = board[row]![col]!.value;
    return {
      kind: "placement",
      position: { row, col },
      value: Number(solution[key]),
      technique: "mistake",
      explanation: `This cell holds ${wrongValue}, but that can't be right — it makes the rest of the puzzle unsolvable. Clear it, then re-check its row, column, and box.`,
      relatedCells: [],
    };
  }

  if (selectedCell) {
    const preferred = nakedSingleAt(board, selectedCell.row, selectedCell.col);
    if (preferred) return preferred;
  }

  const nakedSingle = findNakedSingle(board);
  if (nakedSingle) return nakedSingle;

  const hiddenSingle = findHiddenSingle(board);
  if (hiddenSingle) return hiddenSingle;

  // Before teaching a technique, clear the player's own board of a
  // note that cannot be true: they would otherwise reason from it.
  const impossibleNote = findImpossibleNote(board);
  if (impossibleNote) return impossibleNote;

  // No single anywhere — the state graded boards put players in. Look
  // for the elimination (locked candidates, pairs, triples, X-wing)
  // whose removals make the next placement visible, and teach that.
  const techniqueHint = findTechniqueHint(board);
  if (techniqueHint) return techniqueHint;

  // Fallback: use solution to find the target cell and explain what's possible
  let targetRow = -1;
  let targetCol = -1;
  if (
    selectedCell &&
    board[selectedCell.row]![selectedCell.col]!.value === null
  ) {
    targetRow = selectedCell.row;
    targetCol = selectedCell.col;
  } else {
    for (let r = 0; r < 9 && targetRow === -1; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r]![c]!.value === null) {
          targetRow = r;
          targetCol = c;
          break;
        }
      }
    }
  }
  if (targetRow === -1) return null;

  const value = Number(solution[targetRow * 9 + targetCol]);
  const candidates = candidatesAt(board, targetRow, targetCol);

  return {
    kind: "placement",
    position: { row: targetRow, col: targetCol },
    value,
    technique: "reveal",
    explanation:
      candidates.size <= 3
        ? `No single, pair, triple, or X-wing decides a cell right now — this board needs chain logic. This cell can be ${[...candidates].sort().join(", ")}; the answer is ${value}, and placing it will open the board back up.`
        : `No single, pair, triple, or X-wing decides a cell right now — this board needs chain logic. This cell still has ${candidates.size} candidates; the answer is ${value}, and placing it will open the board back up.`,
    relatedCells: eliminatingCells(board, targetRow, targetCol),
  };
}
