import { cellKey, parsePuzzle } from "../sudoku.ts";
import { candidatesAt } from "../sudoku-candidates.ts";
import type { Position } from "../types.ts";
import type { CellCoord, Challenge, ChallengeQuestion } from "./types.ts";

function toPos(coord: CellCoord): Position {
  return Array.isArray(coord) ? { row: coord[0], col: coord[1] } : coord;
}

class ChallengeBuilder {
  private _puzzle: string = ".".repeat(81);
  private _restricts = new Map<number, Set<number>>();
  private _question: ChallengeQuestion | null = null;
  private _explanation = "";
  private readonly _id: string;
  private readonly _prompt: string;

  constructor(id: string, prompt: string) {
    this._id = id;
    this._prompt = prompt;
  }

  puzzle(puzzle: string): this {
    this._puzzle = puzzle;
    return this;
  }

  restrict(coord: CellCoord, digits: number[]): this {
    const pos = toPos(coord);
    this._restricts.set(cellKey(pos.row, pos.col), new Set(digits));
    return this;
  }

  /**
   * Restrict every empty cell in the unit so the target digit is visible
   * as a candidate ONLY in `present`. Other cells get a small noise set
   * that excludes the digit so the pattern is clean and unambiguous.
   *
   * Use this for select-cells and eliminate challenges where the puzzle
   * is mostly empty and auto-computed candidates would otherwise leak
   * the digit everywhere.
   */
  lockDigit(opts: {
    unit:
      | { kind: "row"; index: number }
      | { kind: "col"; index: number }
      | { kind: "box"; index: number };
    digit: number;
    present: CellCoord[];
  }): this {
    const presentKeys = new Set(
      opts.present.map((c) => {
        const p = toPos(c);
        return cellKey(p.row, p.col);
      }),
    );
    const unitCells = unitCellsOf(opts.unit);
    const board = parsePuzzle(this._puzzle);
    for (let i = 0; i < unitCells.length; i++) {
      const [row, col] = unitCells[i]!;
      if (board[row]![col]!.value !== null) continue;
      const key = cellKey(row, col);
      const isPresent = presentKeys.has(key);
      const existing = this._restricts.get(key);
      if (isPresent) {
        const noise = pickNoise(opts.digit, i, 2);
        const next = existing
          ? new Set([...existing, opts.digit])
          : new Set([opts.digit, ...noise]);
        this._restricts.set(key, next);
      } else {
        const noise = pickNoise(opts.digit, i, 2);
        const next = existing
          ? new Set([...existing].filter((d) => d !== opts.digit))
          : new Set(noise);
        this._restricts.set(key, next);
      }
    }
    return this;
  }

  place(coord: CellCoord, value: number): this {
    this._question = { kind: "place", cell: toPos(coord), value };
    return this;
  }

  selectCells(cells: CellCoord[]): this {
    this._question = { kind: "select-cells", cells: cells.map(toPos) };
    return this;
  }

  eliminateAnswer(coord: CellCoord, digits: number[]): this {
    this._question = {
      kind: "eliminate",
      cell: toPos(coord),
      digits: [...digits],
    };
    return this;
  }

  explain(text: string): this {
    this._explanation = text;
    return this;
  }

  build(): Challenge {
    if (!this._question) {
      throw new Error(
        "Challenge needs an answer: call .place(), .selectCells(), or .eliminateAnswer().",
      );
    }
    const board = parsePuzzle(this._puzzle);
    const initialCandidates = new Map<number, Set<number>>();
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (board[row]![col]!.value === null) {
          initialCandidates.set(
            cellKey(row, col),
            candidatesAt(board, row, col),
          );
        }
      }
    }
    for (const [key, digits] of this._restricts) {
      initialCandidates.set(key, new Set(digits));
    }
    return {
      id: this._id,
      prompt: this._prompt,
      puzzle: this._puzzle,
      initialCandidates,
      question: this._question,
      explanation: this._explanation,
    };
  }
}

export function challenge(id: string, prompt: string): ChallengeBuilder {
  return new ChallengeBuilder(id, prompt);
}

const NOISE_POOL = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function pickNoise(exclude: number, seed: number, count: number): number[] {
  const pool = NOISE_POOL.filter((d) => d !== exclude);
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    result.push(pool[(seed * 2 + i) % pool.length]!);
  }
  // De-dup in case count > pool length (shouldn't happen here).
  return [...new Set(result)];
}

function unitCellsOf(unit: {
  kind: "row" | "col" | "box";
  index: number;
}): [number, number][] {
  if (unit.kind === "row") {
    return Array.from({ length: 9 }, (_, c) => [unit.index, c]);
  }
  if (unit.kind === "col") {
    return Array.from({ length: 9 }, (_, r) => [r, unit.index]);
  }
  const boxRow = Math.floor(unit.index / 3) * 3;
  const boxCol = (unit.index % 3) * 3;
  const result: [number, number][] = [];
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      result.push([r, c]);
    }
  }
  return result;
}
