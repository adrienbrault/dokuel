import { parsePuzzle } from "./sudoku.ts";
import type { Board } from "./types.ts";

/**
 * A player's game as a list of frames, one per board change. Each frame
 * is a flat number array so it crosses the wire (and a JSON round trip)
 * as-is:
 *
 *   [t, cell, packed, cell, packed, ...]
 *
 * `t` is milliseconds since the game started, `cell` is `row * 9 + col`
 * and `packed` holds the cell's whole state after the change: the value
 * (0 for empty) in the low 4 bits, the notes as a bitmask above them.
 * Storing states rather than actions means undo, erase, note
 * auto-elimination and batch edits all replay without the recorder
 * knowing any of them exist.
 */
export type ReplayFrame = number[];

const VALUE_BITS = 4;
const VALUE_MASK = (1 << VALUE_BITS) - 1;

function packCell(value: number | null, notes: Set<number>): number {
  let mask = 0;
  for (const n of notes) mask |= 1 << (n - 1);
  return (value ?? 0) | (mask << VALUE_BITS);
}

/**
 * The frame that takes `prev` to `next` at instant `t`, or null when no
 * cell changed (a selection move, a notes-mode toggle).
 */
export function recordFrame(
  prev: Board,
  next: Board,
  t: number,
): ReplayFrame | null {
  const frame: ReplayFrame = [Math.max(0, Math.round(t))];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const a = prev[row]![col]!;
      const b = next[row]![col]!;
      if (b.isGiven) continue;
      const before = packCell(a.value, a.notes);
      const after = packCell(b.value, b.notes);
      if (before !== after) frame.push(row * 9 + col, after);
    }
  }
  return frame.length > 1 ? frame : null;
}

/** The board as it stood at instant `t`: every frame up to and including it. */
export function replayAt(
  puzzle: string,
  frames: readonly ReplayFrame[],
  t: number,
): Board {
  const board = parsePuzzle(puzzle);
  for (const frame of frames) {
    if (frame[0]! > t) break;
    for (let i = 1; i + 1 < frame.length; i += 2) {
      const cell = board[Math.floor(frame[i]! / 9)]![frame[i]! % 9]!;
      if (cell.isGiven) continue;
      const packed = frame[i + 1]!;
      const value = packed & VALUE_MASK;
      cell.value = value === 0 ? null : value;
      const notes = new Set<number>();
      for (let n = 1; n <= 9; n++) {
        if (packed & (1 << (n - 1 + VALUE_BITS))) notes.add(n);
      }
      cell.notes = notes;
    }
  }
  return board;
}
