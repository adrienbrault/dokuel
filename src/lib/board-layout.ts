/**
 * Pixel geometry of the DOM board: 2px outer padding, 1px gaps between
 * cells of a box and 2px gaps between boxes. The WebGL board mirrors it
 * so every tile lands exactly under its DOM cell.
 */

const PAD = 2;
const THIN = 1;
const THICK = 2;

export function boardSizePx(cellPx: number): number {
  return cellPx * 9 + PAD * 2 + THIN * 6 + THICK * 2;
}

/** Left (or top) edge of column (or row) `i`, from the board's edge. */
export function cellOffsetPx(i: number, cellPx: number): number {
  const box = Math.floor(i / 3);
  return PAD + i * cellPx + (i % 3) * THIN + box * (THIN * 2 + THICK);
}

function indexAt(px: number, cellPx: number): number | null {
  for (let i = 0; i < 9; i++) {
    const start = cellOffsetPx(i, cellPx);
    if (px >= start && px < start + cellPx) return i;
    // Points in a gap belong to the cell after it, so a sweep across
    // the board never falls through a seam.
    if (i > 0 && px < start && px >= start - THICK) return i;
  }
  return null;
}

export function cellAtPx(
  x: number,
  y: number,
  cellPx: number,
): { row: number; col: number } | null {
  const col = indexAt(x, cellPx);
  const row = indexAt(y, cellPx);
  return row === null || col === null ? null : { row, col };
}
