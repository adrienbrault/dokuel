import { describe, expect, it } from "vitest";
import { parsePuzzle } from "./sudoku.ts";
import { candidatesAt, peersOf } from "./sudoku-candidates.ts";

describe("peersOf", () => {
  it("returns 20 unique cells for any position", () => {
    // A cell has 8 row peers, 8 column peers, and 4 remaining box peers
    // (the box's other 8 cells minus the 4 already counted in row/col).
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const peers = peersOf(row, col);
        expect(peers).toHaveLength(20);
        const keys = new Set(peers.map((p) => p.row * 9 + p.col));
        expect(keys.size).toBe(20);
        expect(keys.has(row * 9 + col)).toBe(false);
      }
    }
  });

  it("includes every cell in the same row, column, and box", () => {
    const peers = peersOf(4, 4);
    const keys = new Set(peers.map((p) => p.row * 9 + p.col));
    // All of row 4 except (4,4)
    for (let c = 0; c < 9; c++) {
      if (c !== 4) expect(keys.has(4 * 9 + c)).toBe(true);
    }
    // All of column 4 except (4,4)
    for (let r = 0; r < 9; r++) {
      if (r !== 4) expect(keys.has(r * 9 + 4)).toBe(true);
    }
    // All of center box except (4,4)
    for (let r = 3; r < 6; r++) {
      for (let c = 3; c < 6; c++) {
        if (r !== 4 || c !== 4) expect(keys.has(r * 9 + c)).toBe(true);
      }
    }
  });
});

describe("candidatesAt", () => {
  it("returns all 9 digits for an empty board", () => {
    const board = parsePuzzle(".".repeat(81));
    const candidates = candidatesAt(board, 0, 0);
    expect(candidates).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]));
  });

  it("excludes digits present in the same row", () => {
    const puzzle = `123456789${".".repeat(72)}`;
    const board = parsePuzzle(puzzle);
    // Row 1 (index 1) col 0 — should exclude all values from row 0 in col 0's
    // perspective via the column. But for row 0 col 0, we'd be testing the cell
    // we just filled. Use a different row.
    const candidates = candidatesAt(board, 0, 0);
    // Cell (0,0) has value 1; candidates is about empty cells, but the function
    // doesn't check whether the target is empty — it just reports digits not
    // present among peers. Peers of (0,0) include all of row 0 cols 1–8.
    // Those have 2–9, leaving only 1.
    expect(candidates).toEqual(new Set([1]));
  });

  it("excludes digits present in the same column", () => {
    let puzzle = "";
    for (let r = 0; r < 9; r++) {
      // Fill column 0 with 1–9, rest empty
      puzzle += String(r + 1) + ".".repeat(8);
    }
    const board = parsePuzzle(puzzle);
    // Cell (0,1): peers in column 1 are empty, peers in row 0 col 0 = 1,
    // peers in box (rows 0–2, cols 0–2) = column 0 cells 1, 2, 3.
    // So used = {1, 2, 3} → candidates = {4,5,6,7,8,9}
    const candidates = candidatesAt(board, 0, 1);
    expect(candidates).toEqual(new Set([4, 5, 6, 7, 8, 9]));
  });

  it("excludes digits present in the same 3x3 box", () => {
    // Place 1 at (0,0). Then (2,2) is in the same box and 1 should be excluded.
    const board = parsePuzzle(`1${".".repeat(80)}`);
    const candidates = candidatesAt(board, 2, 2);
    expect(candidates.has(1)).toBe(false);
    expect(candidates.size).toBe(8);
  });
});
