/**
 * Precomputed 9x9 board geometry shared by candidate-based reasoning.
 * Cells are 0-80 indices into the row-major 81-char board format.
 */

// Bits 1..9 mark candidate digits, mirroring the solver's mask layout.
export const ALL_DIGITS = 0b1111111110;

export function boxIndex(cell: number): number {
  return Math.floor(cell / 27) * 3 + Math.floor((cell % 9) / 3);
}

export function popcount(mask: number): number {
  let n = 0;
  let m = mask;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
}

// The 27 houses a human scans: rows, then columns, then boxes.
export const UNITS: number[][] = (() => {
  const units: number[][] = [];
  for (let r = 0; r < 9; r++) {
    units.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  }
  for (let c = 0; c < 9; c++) {
    units.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  }
  for (let b = 0; b < 9; b++) {
    const cells: number[] = [];
    const r0 = Math.floor(b / 3) * 3;
    const c0 = (b % 3) * 3;
    for (let r = r0; r < r0 + 3; r++) {
      for (let c = c0; c < c0 + 3; c++) {
        cells.push(r * 9 + c);
      }
    }
    units.push(cells);
  }
  return units;
})();

// The 20 cells sharing a row, column, or box with each cell.
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const peers = new Set<number>();
  const r = Math.floor(i / 9);
  const c = i % 9;
  for (let k = 0; k < 9; k++) {
    peers.add(r * 9 + k);
    peers.add(k * 9 + c);
  }
  const r0 = Math.floor(boxIndex(i) / 3) * 3;
  const c0 = (boxIndex(i) % 3) * 3;
  for (let rr = r0; rr < r0 + 3; rr++) {
    for (let cc = c0; cc < c0 + 3; cc++) {
      peers.add(rr * 9 + cc);
    }
  }
  peers.delete(i);
  return [...peers];
});
