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

function unpackNotes(packed: number): Set<number> {
  const notes = new Set<number>();
  for (let n = 1; n <= 9; n++) {
    if (packed & (1 << (n - 1 + VALUE_BITS))) notes.add(n);
  }
  return notes;
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
      cell.notes = unpackNotes(packed);
    }
  }
  return board;
}

/** The instant the last change happened, 0 for an untouched board. */
export function replayDuration(frames: readonly ReplayFrame[]): number {
  return frames.length > 0 ? frames[frames.length - 1]![0]! : 0;
}

const MAX_PACKED = (0x1ff << VALUE_BITS) | 9;

function isFrame(raw: unknown): raw is ReplayFrame {
  if (!Array.isArray(raw) || raw.length < 3 || raw.length % 2 === 0) {
    return false;
  }
  if (!raw.every((n) => Number.isInteger(n) && n >= 0)) return false;
  for (let i = 1; i < raw.length; i += 2) {
    const packed = raw[i + 1] as number;
    if ((raw[i] as number) > 80) return false;
    if (packed > MAX_PACKED || (packed & VALUE_MASK) > 9) return false;
  }
  return true;
}

/**
 * A replay that came off the wire, or null when it is not one. Frames
 * must be well formed and in time order: a peer can write anything into
 * the room, and the end screen must not crash or scrub backwards on it.
 */
export function parseReplay(raw: unknown): ReplayFrame[] | null {
  if (!Array.isArray(raw)) return null;
  let last = 0;
  for (const frame of raw) {
    if (!isFrame(frame) || frame[0]! < last) return null;
    last = frame[0]!;
  }
  return raw as ReplayFrame[];
}

export type ProgressPoint = { t: number; filled: number };

/**
 * How many of the puzzle's empty cells held a digit after each frame,
 * starting from an empty board at 0. Erasing and replacing a digit
 * counts, so a player's mistakes show up as dips.
 */
export function progressTimeline(
  puzzle: string,
  frames: readonly ReplayFrame[],
): ProgressPoint[] {
  const filled = new Set<number>();
  const points: ProgressPoint[] = [{ t: 0, filled: 0 }];
  for (const frame of frames) {
    for (let i = 1; i + 1 < frame.length; i += 2) {
      const cell = frame[i]!;
      if (puzzle[cell] !== ".") continue;
      if ((frame[i + 1]! & VALUE_MASK) === 0) filled.delete(cell);
      else filled.add(cell);
    }
    points.push({ t: frame[0]!, filled: filled.size });
  }
  return points;
}

/** The cells the last frame at or before `t` changed. */
export function changedCellsAt(
  frames: readonly ReplayFrame[],
  t: number,
): Set<number> {
  let latest: ReplayFrame | undefined;
  for (const frame of frames) {
    if (frame[0]! > t) break;
    latest = frame;
  }
  const cells = new Set<number>();
  if (!latest) return cells;
  for (let i = 1; i + 1 < latest.length; i += 2) cells.add(latest[i]!);
  return cells;
}
