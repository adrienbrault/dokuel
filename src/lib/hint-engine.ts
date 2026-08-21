import { maskDigits, PEERS, popcount, UNITS } from "./board-geometry.ts";
import {
  type CandidateState,
  findSingle,
  initCandidates,
  type SingleFind,
} from "./candidates.ts";
import { LADDER } from "./ladder.ts";
import { getErrors } from "./sudoku.ts";
import { findTechniqueHint } from "./technique-hint.ts";
import type { ActiveHint, Board, Position } from "./types.ts";

function toPosition(cell: number): Position {
  return { row: Math.floor(cell / 9), col: cell % 9 };
}

/** The 81-char board the candidate substrate is built from. */
function boardValues(board: Board): string {
  let out = "";
  for (const row of board) {
    for (const cell of row) {
      out += cell.value === null ? "." : String(cell.value);
    }
  }
  return out;
}

/** The filled peers — the cells whose digits do the eliminating. */
function eliminatingCells(s: CandidateState, cell: number): Position[] {
  return PEERS[cell]!.filter((peer) => s.grid[peer] !== 0).map(toPosition);
}

function nakedSingleHint(s: CandidateState, cell: number): ActiveHint {
  const value = maskDigits(s.cand[cell]!)[0]!;
  return {
    position: toPosition(cell),
    value,
    technique: "naked-single",
    explanation: `This cell can only be ${value}. All other digits (1-9) already appear in its row, column, or box.`,
    relatedCells: eliminatingCells(s, cell),
  };
}

function unitName(unitIndex: number): string {
  if (unitIndex < 9) return `row ${unitIndex + 1}`;
  if (unitIndex < 18) return `column ${unitIndex - 8}`;
  return `box ${unitIndex - 17}`;
}

/** The word the sentence's tail uses for the house — "this row". */
function unitWord(unitIndex: number): string {
  if (unitIndex < 9) return "row";
  if (unitIndex < 18) return "col";
  return "box";
}

/**
 * A hidden single is proved by what keeps the digit out of the unit's
 * other cells: the unit's own filled cells, plus — for every empty
 * cell of the unit that cannot take the digit — the cells elsewhere
 * that already hold it.
 */
function hiddenSingleHint(
  s: CandidateState,
  single: Extract<SingleFind, { kind: "hidden" }>,
): ActiveHint {
  const { cell, digit, unitIndex } = single;
  const related = new Set<number>();
  for (const other of UNITS[unitIndex]!) {
    if (s.grid[other] !== 0) {
      related.add(other);
      continue;
    }
    if (other === cell || s.cand[other]! & (1 << digit)) continue;
    for (const peer of PEERS[other]!) {
      if (s.grid[peer] === digit) related.add(peer);
    }
  }
  return {
    position: toPosition(cell),
    value: digit,
    technique: "hidden-single",
    explanation: `In ${unitName(unitIndex)}, ${digit} can only go here. The other empty cells in this ${unitWord(unitIndex)} can't contain ${digit} because of conflicts in their rows, columns, or boxes.`,
    relatedCells: [...related].map(toPosition),
  };
}

function mistakeHint(
  board: Board,
  solution: string,
  errors: Set<number>,
): ActiveHint {
  const cell = Math.min(...errors);
  const { row, col } = toPosition(cell);
  const wrongValue = board[row]![col]!.value;
  return {
    position: { row, col },
    value: Number(solution[cell]),
    technique: "mistake",
    explanation: `This cell holds ${wrongValue}, but that can't be right — it makes the rest of the puzzle unsolvable. Clear it, then re-check its row, column, and box.`,
    relatedCells: [],
  };
}

/** The cell a reveal talks about: the selected one when it is empty,
 * otherwise the first empty cell. -1 on a full board. */
function revealTarget(
  s: CandidateState,
  selectedCell?: Position | null,
): number {
  if (selectedCell) {
    const cell = selectedCell.row * 9 + selectedCell.col;
    if (s.grid[cell] === 0) return cell;
  }
  for (let cell = 0; cell < 81; cell++) {
    if (s.grid[cell] === 0) return cell;
  }
  return -1;
}

function revealHint(
  s: CandidateState,
  solution: string,
  cell: number,
): ActiveHint {
  const value = Number(solution[cell]);
  const candidates = maskDigits(s.cand[cell]!);
  // Named from the ladder's last rung: a hand-written list of
  // techniques goes stale the moment a harder one joins.
  const exhausted = `No single, and no technique up to the ${LADDER.at(-1)!.label.toLowerCase()}, decides a cell right now — this board needs chain logic.`;
  return {
    position: toPosition(cell),
    value,
    technique: "reveal",
    explanation:
      candidates.length <= 3
        ? `${exhausted} This cell can be ${candidates.join(", ")}; the answer is ${value}, and placing it will open the board back up.`
        : `${exhausted} This cell still has ${candidates.length} candidates; the answer is ${value}, and placing it will open the board back up.`,
    relatedCells: eliminatingCells(s, cell),
  };
}

/**
 * Find the best hint for the current board state, reading one
 * candidate state built from the board:
 * 1. A wrong entry, which poisons every deduction below it.
 * 2. Naked single (only one candidate possible).
 * 3. Hidden single (value can only go in one place in a unit).
 * 4. The elimination that unlocks the next placement.
 * Falls back to the solution when nothing on the ladder decides a cell.
 *
 * When `selectedCell` is provided and it has a naked single, it wins
 * over any other naked single elsewhere on the board.
 */
export function findHint(
  board: Board,
  solution: string,
  selectedCell?: Position | null,
): ActiveHint | null {
  // A wrong entry poisons every deduction below it: singles derived
  // from a false premise recommend provably wrong digits with full
  // confidence. Surface the mistake first — on a mistake-free board,
  // every single the scans find necessarily matches the solution.
  const errors = getErrors(board, solution);
  if (errors.size > 0) return mistakeHint(board, solution, errors);

  // Mistake-free means every filled cell agrees with the solution, so
  // the board is a prefix of a solved grid and the state always
  // builds. A contradictory board has no deduction left to teach.
  const s = initCandidates(boardValues(board));
  if (!s) return null;

  if (selectedCell) {
    const cell = selectedCell.row * 9 + selectedCell.col;
    if (s.grid[cell] === 0 && popcount(s.cand[cell]!) === 1) {
      return nakedSingleHint(s, cell);
    }
  }

  const single = findSingle(s);
  if (single) {
    return single.kind === "naked"
      ? nakedSingleHint(s, single.cell)
      : hiddenSingleHint(s, single);
  }

  // No single anywhere — the state graded boards put players in. Look
  // for the elimination (locked candidates, pairs, triples, X-wing)
  // whose removals make the next placement visible, and teach that.
  const techniqueHint = findTechniqueHint(s);
  if (techniqueHint) return techniqueHint;

  const target = revealTarget(s, selectedCell);
  return target === -1 ? null : revealHint(s, solution, target);
}
