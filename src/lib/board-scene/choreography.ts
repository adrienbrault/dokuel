import type { Color } from "three";
import { UNITS } from "../board-geometry.ts";
import type { Ripples } from "./effects.ts";
import type { Particles } from "./particles.ts";
import type { BoardTheme } from "./theme.ts";
import type { Tile } from "./tile.ts";

/** What the effects need from the scene: tiles, emitters and a clock. */
export type Stage = {
  tiles: Tile[];
  particles: Particles;
  ripples: Ripples;
  theme: BoardTheme;
  cellPx: number;
  depth: number;
  boardPx: number;
  reducedMotion: boolean;
  after: (seconds: number, run: () => void) => void;
  inkColor: (index: number) => Color;
};

function center(stage: Stage, index: number) {
  const g = stage.tiles[index]!.group.position;
  return { x: g.x, y: g.y };
}

/** Tiles fold up out of the board in a diagonal wave. */
export function reveal(stage: Stage) {
  for (const tile of stage.tiles) {
    const r = Math.floor(tile.index / 9);
    const c = tile.index % 9;
    const digit = tile.pop.target;
    tile.scale.snap(0.001);
    tile.pop.snap(0);
    if (!stage.reducedMotion) tile.rotX.snap(Math.PI * 0.55);
    stage.after((r + c) * 0.035, () => {
      tile.scale.target = 1;
      tile.rotX.target = 0;
      tile.lift.kick(stage.depth * 14);
    });
    stage.after((r + c) * 0.035 + 0.12, () => {
      tile.pop.target = digit;
    });
  }
}

/** A digit lands: the tile dips, the glyph springs up, sparks fly. */
export function placeBurst(stage: Stage, index: number) {
  const tile = stage.tiles[index]!;
  tile.pop.snap(0);
  tile.pop.target = 1;
  tile.pop.kick(9);
  if (stage.reducedMotion) return;
  tile.spin.snap(-Math.PI * 0.6);
  tile.spin.target = 0;
  tile.lift.kick(-stage.depth * 16);
  const { x, y } = center(stage, index);
  const ink = stage.inkColor(index);
  stage.ripples.spawn(x, y, 2, stage.cellPx * 0.75, ink);
  stage.particles.emit({
    x,
    y,
    z: 6,
    count: 16,
    colors: [ink, stage.theme.accentBright],
    speed: stage.cellPx * 5,
    size: Math.max(4, stage.cellPx * 0.16),
    life: 0.55,
    lift: 40,
  });
}

export function clearBurst(stage: Stage, index: number) {
  const tile = stage.tiles[index]!;
  tile.pop.target = 0;
  if (stage.reducedMotion) return;
  tile.spin.target = 0;
  tile.spin.kick(10);
  tile.lift.kick(stage.depth * 8);
}

export function conflictShake(stage: Stage, index: number) {
  if (stage.reducedMotion) return;
  stage.tiles[index]!.shake = 0.45;
}

/** A finished row, column or box: a lit wave runs along it. */
export function unitWave(stage: Stage, unit: number) {
  const cells = UNITS[unit]!;
  cells.forEach((index, i) => {
    stage.after(i * 0.045, () => {
      const tile = stage.tiles[index]!;
      tile.flashColor.copy(stage.theme.accentBright);
      tile.glow.value = stage.theme.isDark ? 0.55 : 0.35;
      tile.glow.target = 0;
      if (stage.reducedMotion) return;
      tile.lift.kick(stage.depth * 26);
      const { x, y } = center(stage, index);
      stage.particles.emit({
        x,
        y,
        z: 8,
        count: 6,
        colors: [stage.theme.accentBright, stage.inkColor(index)],
        speed: stage.cellPx * 2.5,
        size: Math.max(4, stage.cellPx * 0.14),
        life: 0.7,
        lift: 60,
      });
    });
  });
}

/** Solved: a radial wave of flipping tiles and a shower of confetti. */
export function celebrate(stage: Stage) {
  const hues = [
    ...stage.theme.digitColors.slice(1),
    stage.theme.accentBright,
    stage.theme.accent,
  ];
  for (const tile of stage.tiles) {
    const r = Math.floor(tile.index / 9) - 4;
    const c = (tile.index % 9) - 4;
    const delay = Math.hypot(r, c) * 0.075;
    stage.after(delay, () => {
      tile.flashColor.copy(stage.theme.accentBright);
      tile.glow.value = stage.theme.isDark ? 0.5 : 0.45;
      tile.glow.target = 0;
      if (stage.reducedMotion) return;
      tile.flip();
      tile.lift.kick(stage.depth * 40);
    });
  }
  if (stage.reducedMotion) return;
  const half = stage.boardPx / 2;
  for (let wave = 0; wave < 4; wave++) {
    stage.after(0.15 + wave * 0.28, () => {
      for (let i = 0; i < 8; i++) {
        stage.particles.emit({
          x: (Math.random() - 0.5) * stage.boardPx,
          y: half - Math.random() * stage.cellPx,
          z: 30,
          count: 6,
          colors: hues,
          speed: stage.cellPx * 2,
          size: Math.max(7, stage.cellPx * 0.26),
          life: 2.2,
          shape: "confetti",
          gravity: stage.cellPx * 7,
          lift: 20,
        });
      }
    });
  }
}
