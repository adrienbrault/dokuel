import { findHiddenSingle } from "./hint-hidden-single.ts";
import type { Board, Position } from "./types.ts";

export type HintExplanation = {
  position: Position;
  value: number;
  technique: "naked-single" | "hidden-single";
  explanation: string;
  relatedCells: Position[];
};

/**
 * Compute candidates for a single cell: digits 1-9 not already present
 * in the same row, column, or 3x3 box.
 */
function getCandidates(board: Board, row: number, col: number): Set<number> {
  const used = new Set<number>();

  // Row
  for (let c = 0; c < 9; c++) {
    const v = board[row]![c]!.value;
    if (v !== null) used.add(v);
  }
  // Column
  for (let r = 0; r < 9; r++) {
    const v = board[r]![col]!.value;
    if (v !== null) used.add(v);
  }
  // Box
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      const v = board[r]![c]!.value;
      if (v !== null) used.add(v);
    }
  }

  const candidates = new Set<number>();
  for (let d = 1; d <= 9; d++) {
    if (!used.has(d)) candidates.add(d);
  }
  return candidates;
}

/**
 * Find cells in the same row, column, or box that eliminate candidates
 * for a given cell, returning only those whose values matter.
 */
function getEliminatingCells(
  board: Board,
  row: number,
  col: number,
): Position[] {
  const related: Position[] = [];
  const seen = new Set<number>();

  const addIfNew = (r: number, c: number) => {
    const v = board[r]![c]!.value;
    if (v !== null) {
      const key = r * 9 + c;
      if (!seen.has(key)) {
        seen.add(key);
        related.push({ row: r, col: c });
      }
    }
  };

  for (let c = 0; c < 9; c++) {
    if (c !== col) addIfNew(row, c);
  }
  for (let r = 0; r < 9; r++) {
    if (r !== row) addIfNew(r, col);
  }
  const bRow = Math.floor(row / 3) * 3;
  const bCol = Math.floor(col / 3) * 3;
  for (let r = bRow; r < bRow + 3; r++) {
    for (let c = bCol; c < bCol + 3; c++) {
      if (r !== row || c !== col) addIfNew(r, c);
    }
  }

  return related;
}

/**
 * Try to find a naked single: a cell where only one candidate remains.
 */
function findNakedSingle(board: Board): HintExplanation | null {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row]![col]!.value !== null) continue;
      const candidates = getCandidates(board, row, col);
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
      const candidates = getCandidates(
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
  const candidates = getCandidates(board, targetRow, targetCol);

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
