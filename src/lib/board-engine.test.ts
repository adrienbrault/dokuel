import { describe, expect, it } from "vitest";
import { initState, serializeBoard } from "./board-engine.ts";

describe("serializeBoard", () => {
  it("round-trips through initState", () => {
    const puzzle =
      "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
    const fresh = initState({ puzzle }).board;
    fresh[0]![2]!.value = 4;
    fresh[0]![3]!.notes = new Set([1, 2, 9]);
    fresh[8]![6]!.notes = new Set([3]);

    const saved = serializeBoard(fresh);
    const restored = initState({ puzzle, savedBoard: saved }).board;

    expect(serializeBoard(restored)).toEqual(saved);
    expect(restored[0]![2]!.value).toBe(4);
    expect([...restored[0]![3]!.notes].sort()).toEqual([1, 2, 9]);
    expect([...restored[8]![6]!.notes]).toEqual([3]);
  });

  it("encodes empty cells as '.' and preserves given cells", () => {
    const puzzle =
      "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
    const board = initState({ puzzle }).board;
    const { values } = serializeBoard(board);
    expect(values).toBe(puzzle);
  });
});
