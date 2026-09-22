import { describe, expect, it } from "vitest";
import { recordFrame, replayAt } from "./replay.ts";
import { parsePuzzle } from "./sudoku.ts";

const PUZZLE =
  "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";

describe("replay", () => {
  it("rebuilds the board a player had at any instant", () => {
    const start = parsePuzzle(PUZZLE);
    const placed = parsePuzzle(PUZZLE);
    placed[0]![2]!.value = 4;
    const noted = parsePuzzle(PUZZLE);
    noted[0]![2]!.value = 4;
    noted[0]![3]!.notes = new Set([2, 6]);

    const frames = [
      recordFrame(start, placed, 1_000),
      recordFrame(placed, noted, 5_000),
    ].filter((f) => f !== null);

    expect(replayAt(PUZZLE, frames, 0)[0]![2]!.value).toBeNull();
    const mid = replayAt(PUZZLE, frames, 2_000);
    expect(mid[0]![2]!.value).toBe(4);
    expect(mid[0]![3]!.notes.size).toBe(0);
    const end = replayAt(PUZZLE, frames, 5_000);
    expect(end[0]![3]!.notes).toEqual(new Set([2, 6]));
    expect(end[0]![0]!.isGiven).toBe(true);
  });
});
