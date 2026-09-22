import { describe, expect, it } from "vitest";
import {
  changedCellsAt,
  parseReplay,
  progressTimeline,
  recordFrame,
  replayAt,
  replayDuration,
} from "./replay.ts";
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

  it("only accepts peer replays shaped like frames", () => {
    const valid = [
      [0, 2, 4],
      [900, 3, 0b100010 << 4],
    ];
    expect(parseReplay(valid)).toEqual(valid);
    expect(parseReplay("nope")).toBeNull();
    expect(parseReplay([[0, 81, 4]])).toBeNull();
    expect(parseReplay([[0, 2]])).toBeNull();
    expect(parseReplay([[0, 2, 10]])).toBeNull();
    expect(parseReplay([[0, 2, 1 << 13]])).toBeNull();
    expect(parseReplay([[1.5, 2, 4]])).toBeNull();
    // Out-of-order frames would replay a later state before an earlier one.
    expect(
      parseReplay([
        [500, 2, 4],
        [100, 2, 5],
      ]),
    ).toBeNull();
  });

  it("charts how many cells a player had filled over time", () => {
    const frames = [
      [1_000, 2, 4],
      [2_000, 3, 6, 5, 1],
      [3_000, 3, 0b10 << 4],
    ];
    expect(progressTimeline(PUZZLE, frames)).toEqual([
      { t: 0, filled: 0 },
      { t: 1_000, filled: 1 },
      { t: 2_000, filled: 3 },
      { t: 3_000, filled: 2 },
    ]);
  });

  it("names the cells the latest change at an instant touched", () => {
    const frames = [
      [1_000, 2, 4],
      [2_000, 3, 6, 5, 1],
    ];
    expect(changedCellsAt(frames, 500)).toEqual(new Set());
    expect(changedCellsAt(frames, 1_500)).toEqual(new Set([2]));
    expect(changedCellsAt(frames, 2_000)).toEqual(new Set([3, 5]));
  });

  it("ends at the last frame's instant", () => {
    expect(replayDuration([])).toBe(0);
    expect(
      replayDuration([
        [100, 2, 4],
        [4_200, 2, 0],
      ]),
    ).toBe(4_200);
  });
});
