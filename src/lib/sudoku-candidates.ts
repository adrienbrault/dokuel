import type { Board, Position } from "./types.ts";

/**
 * Positions of the 20 cells that share a row, column, or 3×3 box with
 * (row, col), excluding (row, col) itself. Computed purely from the
 * geometry — no board contents are read.
 */
export function peersOf(row: number, col: number): Position[] {
  const peers: Position[] = [];
  const seen = new Set<number>();

  const add = (r: number, c: number) => {
    if (r === row && c === col) return;
    const key = r * 9 + c;
    if (seen.has(key)) return;
    seen.add(key);
    peers.push({ row: r, col: c });
  };

  for (let c = 0; c < 9; c++) add(row, c);
  for (let r = 0; r < 9; r++) add(r, col);

  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      add(r, c);
    }
  }

  return peers;
}

/**
 * Digits 1–9 that can legally occupy (row, col) under sudoku rules — i.e.
 * digits not already present in any of its peers.
 */
export function candidatesAt(
  board: Board,
  row: number,
  col: number,
): Set<number> {
  const used = new Set<number>();
  for (const { row: r, col: c } of peersOf(row, col)) {
    const v = board[r]![c]!.value;
    if (v !== null) used.add(v);
  }
  const candidates = new Set<number>();
  for (let d = 1; d <= 9; d++) {
    if (!used.has(d)) candidates.add(d);
  }
  return candidates;
}
