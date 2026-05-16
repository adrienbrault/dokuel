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
