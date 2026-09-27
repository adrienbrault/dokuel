import { describe, expect, it } from "vitest";
import { boardSizePx, cellAtPx, cellOffsetPx } from "./board-layout.ts";

describe("board layout", () => {
  it("sizes the board as nine cells plus its gaps and outer padding", () => {
    expect(boardSizePx(40)).toBe(40 * 9 + 14);
  });

  it("offsets cells past thin in-box gaps and thick between-box gaps", () => {
    expect(cellOffsetPx(0, 40)).toBe(2);
    expect(cellOffsetPx(1, 40)).toBe(2 + 40 + 1);
    expect(cellOffsetPx(3, 40)).toBe(2 + 3 * 40 + 2 + 2);
    expect(cellOffsetPx(8, 40) + 40 + 2).toBe(boardSizePx(40));
  });

  it("finds the cell under a point, and none over the outer padding", () => {
    expect(cellAtPx(2, 2, 40)).toEqual({ row: 0, col: 0 });
    expect(cellAtPx(cellOffsetPx(4, 40) + 5, cellOffsetPx(7, 40), 40)).toEqual({
      row: 7,
      col: 4,
    });
    expect(cellAtPx(1, 50, 40)).toBeNull();
    expect(cellAtPx(50, boardSizePx(40), 40)).toBeNull();
  });
});
