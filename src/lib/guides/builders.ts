import { cellKey, parsePuzzle } from "../sudoku.ts";
import { candidatesAt } from "../sudoku-candidates.ts";
import type { Demo } from "./types.ts";

class DemoBuilder {
  private _puzzle: string = ".".repeat(81);

  constructor(
    private readonly _id: string,
    private readonly _title: string,
  ) {}

  puzzle(puzzle: string): this {
    this._puzzle = puzzle;
    return this;
  }

  build(): Demo {
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
    return {
      id: this._id,
      title: this._title,
      puzzle: this._puzzle,
      initialCandidates,
      steps: [],
    };
  }
}

export function demo(id: string, title: string): DemoBuilder {
  return new DemoBuilder(id, title);
}
