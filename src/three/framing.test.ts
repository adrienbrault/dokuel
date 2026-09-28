import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { FOV, fitCamera, resolveCellHit, toNdc } from "./framing.ts";
import { BOARD_SPAN, cellPosition, TILE_DEPTH } from "./layout.ts";

const HALF_FOV_RAD = ((FOV / 2) * Math.PI) / 180;
const RECT = { left: 0, top: 0, width: 400, height: 400 };

/** A camera framed the way the board frames itself, looking at the origin. */
function framedCamera(boardPx: number, canvasPx = 400) {
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.z = fitCamera(camera, canvasPx, canvasPx, boardPx);
  return camera;
}

const TILE_PLANE_Z = TILE_DEPTH / 2;

/**
 * Client coordinates for a point on the tile plane, projected through the
 * camera itself rather than reimplemented, so a tilted camera is honoured.
 */
function project(camera: PerspectiveCamera, worldX: number, worldY: number) {
  camera.updateMatrixWorld();
  const ndc = new Vector3(worldX, worldY, TILE_PLANE_Z).project(camera);
  return {
    x: ((ndc.x + 1) / 2) * RECT.width + RECT.left,
    y: ((1 - ndc.y) / 2) * RECT.height + RECT.top,
  };
}

describe("fitCamera", () => {
  it("frames the grid exactly when the board fills the canvas", () => {
    const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
    const distance = fitCamera(camera, 400, 400, 400);
    // At this distance the visible height equals the grid's own span.
    expect(2 * Math.tan(HALF_FOV_RAD) * distance).toBeCloseTo(BOARD_SPAN, 6);
  });

  it("backs off when the board only fills half the canvas", () => {
    const half = fitCamera(
      new PerspectiveCamera(FOV, 1, 0.1, 100),
      400,
      400,
      200,
    );
    const full = fitCamera(
      new PerspectiveCamera(FOV, 1, 0.1, 100),
      400,
      400,
      400,
    );
    expect(half).toBeCloseTo(full * 2, 6);
  });

  it("sets the aspect it frames with", () => {
    const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
    fitCamera(camera, 600, 300, 300);
    expect(camera.aspect).toBe(2);
  });
});

describe("toNdc", () => {
  it("maps a canvas centre to the origin", () => {
    expect(toNdc(RECT, 200, 200)).toEqual({ x: 0, y: 0 });
  });

  it("maps the top-left corner to negative x and positive y", () => {
    expect(toNdc(RECT, 0, 0)).toEqual({ x: -1, y: 1 });
  });

  it("rejects a canvas with no area", () => {
    expect(toNdc({ ...RECT, width: 0 }, 0, 0)).toBeNull();
  });
});

describe("resolveCellHit", () => {
  it("resolves the centre of the board to the centre cell", () => {
    const camera = framedCamera(400);
    expect(resolveCellHit(camera, RECT, 200, 200)).toEqual({
      row: 4,
      col: 4,
      localY: 0.5,
    });
  });

  it("resolves every cell to itself", () => {
    const camera = framedCamera(400);
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const [x, y] = cellPosition(row, col);
        const point = project(camera, x, y);
        expect(resolveCellHit(camera, RECT, point.x, point.y)).toMatchObject({
          row,
          col,
        });
      }
    }
  });

  it("splits a cell so its upper half takes a value and its lower half a note", () => {
    const camera = framedCamera(400);
    const [x, y] = cellPosition(2, 6);
    const above = project(camera, x, y + 0.4);
    const below = project(camera, x, y - 0.4);
    expect(resolveCellHit(camera, RECT, above.x, above.y)).toMatchObject({
      row: 2,
      col: 6,
    });
    expect(resolveCellHit(camera, RECT, above.x, above.y)!.localY).toBeLessThan(
      0.5,
    );
    expect(resolveCellHit(camera, RECT, below.x, below.y)).toMatchObject({
      row: 2,
      col: 6,
    });
    expect(
      resolveCellHit(camera, RECT, below.x, below.y)!.localY,
    ).toBeGreaterThan(0.5);
  });

  it("rejects a point that falls in the gap between two tiles", () => {
    const camera = framedCamera(400);
    // The centre of the gap between the two boxes in the top row.
    const between = project(
      camera,
      (cellPosition(0, 2)[0] + cellPosition(0, 3)[0]) / 2,
      0,
    );
    expect(resolveCellHit(camera, RECT, between.x, between.y)).toBeNull();
  });

  it("rejects a point that misses the grid entirely", () => {
    // A board that fills only half the canvas leaves its corners empty.
    const camera = framedCamera(200);
    expect(resolveCellHit(camera, RECT, 4, 4)).toBeNull();
  });

  it("still resolves cells after the camera has tilted", () => {
    const camera = framedCamera(400);
    // The parallax the board actually uses, so a tilt must not move a
    // cell's edges past the pointer that selects it.
    camera.position.x = 0.012;
    camera.lookAt(0, 0, 0);
    const [x, y] = cellPosition(4, 4);
    const point = project(camera, x, y);
    expect(resolveCellHit(camera, RECT, point.x, point.y)).toMatchObject({
      row: 4,
      col: 4,
    });
  });
});
