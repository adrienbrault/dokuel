import { describe, expect, it } from "vitest";
import {
  axis,
  BOARD_SPAN,
  BOX_GAP,
  CELL,
  cameraDistance,
  cellPosition,
  framingHeight,
  noteOffset,
  noteRowOffset,
  noteSize,
} from "./layout.ts";

describe("axis", () => {
  it("centres the grid on the origin", () => {
    expect(axis(4)).toBeCloseTo(0, 10);
    // Centres span the board minus one tile's width on the outside.
    expect(axis(8) - axis(0)).toBeCloseTo(BOARD_SPAN - CELL, 10);
  });

  it("mirrors around the middle, so the board is symmetric", () => {
    for (const i of [0, 1, 2, 3]) {
      expect(axis(i)).toBeCloseTo(-axis(8 - i), 10);
    }
  });

  it("holds a wider gap between boxes than between cells", () => {
    // Edge-to-edge is the honest measure: centre-to-centre also carries
    // half a cell on each side.
    const innerGap = axis(1) - 0.5 - (axis(0) + 0.5);
    const boxGap = axis(3) - 0.5 - (axis(2) + 0.5);
    expect(innerGap).toBeCloseTo(0.06, 10);
    expect(boxGap).toBeCloseTo(BOX_GAP, 10);
    expect(boxGap).toBeGreaterThan(innerGap);
  });

  it("leaves the outermost tiles flush with the board edge", () => {
    // Half a tile in from each extreme is exactly half the board span.
    expect(axis(0) - 0.5).toBeCloseTo(-BOARD_SPAN / 2, 10);
    expect(axis(8) + 0.5).toBeCloseTo(BOARD_SPAN / 2, 10);
  });
});

describe("cellPosition", () => {
  it("maps row and column to x and y with y growing downwards", () => {
    const [x0, y0] = cellPosition(0, 0);
    expect(x0).toBeCloseTo(axis(0), 10);
    // Row 0 is the top row, and WebGL y grows upwards, so its y is the
    // largest of the grid.
    expect(y0).toBeCloseTo(-axis(0), 10);
    const [, y8] = cellPosition(8, 0);
    expect(y8).toBeLessThan(y0);
  });

  it("keeps every cell inside the board span", () => {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const [x, y] = cellPosition(row, col);
        expect(Math.abs(x)).toBeLessThanOrEqual(BOARD_SPAN / 2);
        expect(Math.abs(y)).toBeLessThanOrEqual(BOARD_SPAN / 2);
      }
    }
  });
});

describe("note slots", () => {
  it("splits a tile into thirds the way the DOM grid does", () => {
    expect(noteOffset(0)).toBeCloseTo(-1 / 3, 5);
    expect(noteOffset(1)).toBeCloseTo(0, 10);
    expect(noteOffset(2)).toBeCloseTo(1 / 3, 5);
    expect(noteSize()).toBeLessThan(1);
    // Three notes side by side must not overlap.
    expect(noteOffset(2) - noteOffset(1)).toBeGreaterThanOrEqual(noteSize());
    // Rows mirror columns: notes fill the tile as a three-by-three grid.
    expect(noteRowOffset(0)).toBeCloseTo(noteOffset(0), 10);
    expect(noteRowOffset(2)).toBeCloseTo(noteOffset(2), 10);
  });
});

describe("framing", () => {
  it("scales the visible height so the board matches its CSS box", () => {
    // A 400px canvas whose board paints 386px of that: the visible world
    // height must be board span * 400/386 so tiles land on cell pixels.
    expect(framingHeight(BOARD_SPAN, 400, 386)).toBeCloseTo(
      (BOARD_SPAN * 400) / 386,
      6,
    );
  });

  it("shrinks the visible height as the board fills more of the canvas", () => {
    const loose = framingHeight(BOARD_SPAN, 400, 300);
    const tight = framingHeight(BOARD_SPAN, 400, 400);
    expect(tight).toBeLessThan(loose);
  });

  it("places the camera far enough back to cover the framed height", () => {
    const height = 10;
    const fov = 30;
    const d = cameraDistance(height, fov);
    // Visible height at distance d for a vertical fov: 2 * d * tan(fov/2).
    expect(2 * d * Math.tan(((fov / 2) * Math.PI) / 180)).toBeCloseTo(
      height,
      8,
    );
  });
});
