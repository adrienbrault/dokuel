import { cellKey } from "./sudoku.ts";
import type { Board } from "./types.ts";

function position(row: number, col: number): string {
  return `row ${row + 1} column ${col + 1}`;
}

type NoteChange = { at: string; added: number[]; removed: number[] };

/** "Note 3 added" when every change toggles the same single digit. */
function singleNoteVerb(changes: NoteChange[]): string | null {
  const phrase = ({ added, removed }: NoteChange) => {
    if (added.length + removed.length !== 1) return null;
    return added.length === 1
      ? `Note ${added[0]} added`
      : `Note ${removed[0]} removed`;
  };
  const phrases = new Set(changes.map(phrase));
  const [only] = phrases;
  return phrases.size === 1 ? (only ?? null) : null;
}

function describeNoteChanges(changes: NoteChange[]): string | null {
  const [first] = changes;
  if (!first) return null;
  const what = singleNoteVerb(changes) ?? "Notes updated";
  return changes.length === 1
    ? `${what}, ${first.at}`
    : `${what} in ${changes.length} cells`;
}

/**
 * One short sentence describing what changed between two boards, for a
 * polite live region. Returns null when there is nothing worth saying.
 *
 * A value change wins over note changes: placing a digit also clears
 * that digit from peer notes, and the placement is what matters.
 */
export function describeBoardChange(
  prev: Board,
  next: Board,
  conflicts: Set<number>,
): string | null {
  const noteChanges: NoteChange[] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const before = prev[r]?.[c];
      const after = next[r]?.[c];
      if (!(before && after)) continue;
      if (after.value !== before.value) {
        return describeValueChange(before.value, after.value, r, c, conflicts);
      }
      const added = [...after.notes].filter((n) => !before.notes.has(n));
      const removed = [...before.notes].filter((n) => !after.notes.has(n));
      if (added.length > 0 || removed.length > 0) {
        noteChanges.push({ at: position(r, c), added, removed });
      }
    }
  }
  return describeNoteChanges(noteChanges);
}

function describeValueChange(
  before: number | null,
  after: number | null,
  row: number,
  col: number,
  conflicts: Set<number>,
): string {
  if (after === null) return `${before} erased, ${position(row, col)}`;
  const conflict = conflicts.has(cellKey(row, col)) ? ", conflict" : "";
  return `${after} placed, ${position(row, col)}${conflict}`;
}
