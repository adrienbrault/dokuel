import { findHiddenSingle } from "./hint-hidden-single.ts";
import { candidatesAt, peersOf } from "./sudoku-candidates.ts";
import type { Board, Position } from "./types.ts";

export type HintExplanation = {
  position: Position;
  value: number;
  technique: "naked-single" | "hidden-single";
  explanation: string;
  relatedCells: Position[];
};

/**
 * Peers that already hold a value — i.e., the cells that explain why a
 * naked-single deduction is forced.
 */
function getEliminatingCells(
  board: Board,
  row: number,
  col: number,
): Position[] {
  return peersOf(row, col).filter(
    ({ row: r, col: c }) => board[r]![c]!.value !== null,
  );
}

/**
 * Try to find a naked single: a cell where only one candidate remains.
 */
function findNakedSingle(board: Board): HintExplanation | null {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row]![col]!.value !== null) continue;
      const candidates = candidatesAt(board, row, col);
      if (candidates.size === 1) {
        const value = [...candidates][0]!;
        const related = getEliminatingCells(board, row, col);
        return {
          position: { row, col },
          value,
          technique: "naked-single",
          explanation: `This cell can only be ${value}. All other digits (1-9) already appear in its row, column, or box.`,
          relatedCells: related,
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
 */
export function findHint(
  board: Board,
  solution: string,
  selectedCell?: Position | null,
): HintExplanation | null {
  // If there's a selected empty cell, check if it has a simple deduction first
  if (selectedCell) {
    const cell = board[selectedCell.row]![selectedCell.col]!;
    if (cell.value === null) {
      const candidates = candidatesAt(
        board,
        selectedCell.row,
        selectedCell.col,
      );
      if (candidates.size === 1) {
        const value = [...candidates][0]!;
        return {
          position: selectedCell,
          value,
          technique: "naked-single",
          explanation: `This cell can only be ${value}. All other digits (1-9) already appear in its row, column, or box.`,
          relatedCells: getEliminatingCells(
            board,
            selectedCell.row,
            selectedCell.col,
          ),
        };
      }
    }
  }

  // Try naked singles across the board
  const nakedSingle = findNakedSingle(board);
  if (nakedSingle) return nakedSingle;

  // Try hidden singles
  const hiddenSingle = findHiddenSingle(board);
  if (hiddenSingle) return hiddenSingle;

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
    position: { row: targetRow, col: targetCol },
    value,
    technique: "naked-single",
    explanation:
      candidates.size <= 3
        ? `This cell's candidates are ${[...candidates].sort().join(", ")}. The answer is ${value} — try analyzing which values are possible in neighboring cells to narrow it down.`
        : `This cell has ${candidates.size} candidates: ${[...candidates].sort().join(", ")}. The answer is ${value}. Look for cells with fewer candidates first, or try finding where ${value} must go in this row, column, or box.`,
    relatedCells: getEliminatingCells(board, targetRow, targetCol),
  };
}
