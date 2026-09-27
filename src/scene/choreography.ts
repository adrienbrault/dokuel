import { Color } from "three";
import type { AmbianceEvent } from "../lib/ambiance.ts";
import { damp } from "./damp.ts";
import type { createFloor } from "./floor.ts";
import type { ScenePalette } from "./palette.ts";
import type { createTiles } from "./tiles.ts";

type Floor = ReturnType<typeof createFloor>;
type Tiles = Awaited<ReturnType<typeof createTiles>>;
type Rect = [minX: number, minZ: number, maxX: number, maxZ: number];

/** Where the rival's board sits on the floor: the neighbor to the north. */
const RIVAL_BOARD_Z = -9;
/** How long a win keeps the world lit up, in seconds. */
const VICTORY_SECONDS = 9;

/** Board cell (row, col) to floor (x, z): the board is centered on 0. */
function cellToFloor(row: number, col: number): [number, number] {
  return [col - 4, row - 4];
}

function unitRect(kind: "row" | "col" | "box", i: number): Rect {
  if (kind === "row") return [-4.5, i - 4.5, 4.5, i - 3.5];
  if (kind === "col") return [i - 4.5, -4.5, i - 3.5, 4.5];
  const x = (i % 3) * 3 - 4.5;
  const z = Math.floor(i / 3) * 3 - 4.5;
  return [x, z, x + 3, z + 3];
}

/**
 * Turns game events into light: ripples and sweeps on the floor, tiles
 * flaring, a bloom kick, a full-frame flash. Owns the timing of those
 * effects so the engine only asks "how lit is the world right now".
 */
export function createChoreography(floor: Floor, tiles: Tiles) {
  let victoryAt = -1e4;
  let bloomBoost = 0;
  let flashAmount = 0;
  const flash = new Color();

  function kick(amount: number) {
    bloomBoost = Math.max(bloomBoost, amount);
  }

  function flashTo(color: Color, amount: number) {
    flash.copy(color);
    flashAmount = Math.max(flashAmount, amount);
  }

  function celebrate(p: ScenePalette, time: number) {
    victoryAt = time;
    floor.sweep([-4.5, -4.5, 4.5, 4.5], p.gold, 1.6, time);
    floor.ripple(0, 0, p.gold, 2.2, time);
    for (const [x, z] of [
      [-4, -4],
      [4, -4],
      [-4, 4],
      [4, 4],
    ] as const) {
      floor.ripple(x, z, p.accentHot, 1.2, time + 0.35);
    }
    tiles.flashAll(1.4);
    kick(1.4);
    flashTo(p.gold, p.additive ? 0.12 : 0.1);
  }

  return {
    handle(event: AmbianceEvent, p: ScenePalette, time: number) {
      switch (event.type) {
        case "place": {
          const [x, z] = cellToFloor(event.row, event.col);
          floor.ripple(x, z, p.accent, 1, time);
          tiles.flashDigit(event.digit, 1);
          kick(0.15);
          return;
        }
        case "conflict": {
          const [x, z] = cellToFloor(event.row, event.col);
          floor.ripple(x, z, p.conflict, 1.3, time);
          flashTo(p.conflict, p.additive ? 0.05 : 0.08);
          return;
        }
        case "unit":
          floor.sweep(unitRect(event.kind, event.index), p.accentHot, 1, time);
          tiles.flashAll(0.45);
          kick(0.5);
          return;
        case "rival": {
          const x = Math.floor(Math.random() * 9) - 4;
          const z = RIVAL_BOARD_Z + Math.floor(Math.random() * 9) - 4;
          floor.ripple(x, z, p.rival, 0.9, time);
          return;
        }
        case "victory":
          celebrate(p, time);
          return;
      }
    },
    /** Advance the effects' decay; returns the victory surge, 0..~1. */
    step(time: number, dt: number): number {
      bloomBoost = damp(bloomBoost, 0, 1.8, dt);
      flashAmount = damp(flashAmount, 0, 3.5, dt);
      const age = time - victoryAt;
      if (age < 0 || age > VICTORY_SECONDS) return 0;
      // A win swells, holds, then settles over several seconds.
      return Math.min(1, age * 2) * Math.exp(-age * 0.35);
    },
    get bloomBoost() {
      return bloomBoost;
    },
    get flash() {
      return flash;
    },
    get flashAmount() {
      return flashAmount;
    },
  };
}
