import {
  BufferGeometry,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PMREMGenerator,
  type Scene,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { boardSizePx, cellOffsetPx } from "../board-layout.ts";
import { shadowTexture } from "./effects.ts";
import type { BoardTheme } from "./theme.ts";
import type { Tile } from "./tile.ts";

type BoardParts = { tiles: Tile[]; plates: Mesh[]; base: Mesh; shadow: Mesh };

/** A transparent renderer, plus the studio lighting the tiles shine in. */
export function createRenderer(
  canvas: HTMLCanvasElement,
  scene: Scene,
): WebGLRenderer {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  // Tuned so a tile's flat top renders close to its CSS token (the
  // lights sum to ~1 facing the camera) while bevels facing away from
  // the upper-left key fall into shade: that contrast is the depth.
  const hemi = new HemisphereLight(0xffffff, 0xb0b4bc, 1.05);
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(-0.5, 0.8, 3);
  scene.add(hemi, key);
  return renderer;
}

/** The board's static body: a frame slab, nine box plates, a shadow. */
export function createBoardParts() {
  const plateMaterial = () =>
    new MeshStandardMaterial({ roughness: 0.7, metalness: 0 });
  return {
    base: new Mesh(new BufferGeometry(), plateMaterial()),
    plates: Array.from(
      { length: 9 },
      () => new Mesh(new BufferGeometry(), plateMaterial()),
    ),
    shadow: new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({
        map: shadowTexture(),
        transparent: true,
        depthWrite: false,
        color: 0x000000,
      }),
    ),
  };
}

/**
 * Rebuilds the board's geometry for a cell size, placing every tile and
 * box plate exactly under its DOM counterpart. Tile tops sit at z = 0,
 * the plane the camera maps 1:1 onto CSS pixels.
 */
export function layoutBoard(parts: BoardParts, cellPx: number, d: number) {
  const boardPx = boardSizePx(cellPx);
  const tileGeometry = new RoundedBoxGeometry(
    cellPx,
    cellPx,
    d,
    3,
    Math.min(cellPx * 0.07, d * 0.48),
  );
  const oldGlyph = parts.tiles[0]?.value.geometry;
  const glyphGeometry = new PlaneGeometry(cellPx, cellPx);
  const half = boardPx / 2;
  for (const tile of parts.tiles) {
    tile.body.geometry.dispose();
    tile.setGeometry(tileGeometry, glyphGeometry, d);
    const r = Math.floor(tile.index / 9);
    const c = tile.index % 9;
    tile.group.position.x = cellOffsetPx(c, cellPx) + cellPx / 2 - half;
    tile.group.position.y = half - (cellOffsetPx(r, cellPx) + cellPx / 2);
  }
  oldGlyph?.dispose();
  const boxPx = cellPx * 3 + 2;
  parts.plates.forEach((plate, b) => {
    plate.geometry.dispose();
    plate.geometry = new RoundedBoxGeometry(boxPx, boxPx, d, 3, 2);
    const r0 = Math.floor(b / 3) * 3;
    const c0 = (b % 3) * 3;
    plate.position.set(
      cellOffsetPx(c0, cellPx) + boxPx / 2 - half,
      half - (cellOffsetPx(r0, cellPx) + boxPx / 2),
      -d * 1.05,
    );
  });
  parts.base.geometry.dispose();
  parts.base.geometry = new RoundedBoxGeometry(
    boardPx + 4,
    boardPx + 4,
    d,
    4,
    Math.min(6, d * 0.45),
  );
  parts.base.position.z = -d * 1.3;
  parts.shadow.scale.setScalar(boardPx * 1.2);
  parts.shadow.position.set(0, -cellPx * 0.25, -d * 2.2);
}

/** Recolors the board body and retunes tile finish for a theme. */
export function paintTheme(parts: BoardParts, theme: BoardTheme) {
  (parts.base.material as MeshStandardMaterial).color.copy(theme.boardBorder);
  for (const p of parts.plates) {
    (p.material as MeshStandardMaterial).color.copy(theme.borderDefault);
  }
  (parts.shadow.material as MeshBasicMaterial).opacity = theme.isDark
    ? 0.55
    : 0.22;
  for (const t of parts.tiles) {
    t.shadowStrength = theme.isDark ? 0.7 : 0.32;
  }
}
