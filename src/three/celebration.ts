import { clamp01, easeOutCubic } from "./easing.ts";
import { BLOOM_STRENGTH } from "./pipeline.ts";

/** How long the whole moment runs. */
const DURATION = 2.6;
/** How long a single tile spends rising and falling back. */
const LIFT_SPREAD = 0.45;
/** How far a tile lifts as the wave passes it. */
const LIFT_HEIGHT = 0.45;
/** How far the camera eases back, as a fraction of its resting distance. */
const PULL_BACK = 0.14;
/** The most the bloom opens, at the middle of the moment. */
const BLOOM_PEAK = 0.6;
/** Half a degree of sway, damped away as the moment closes. */
const SWAY = 0.014;

/**
 * The parts of the scene the moment moves. Typed by shape rather than by
 * Three class so a test can hand in a plain object.
 */
export type CelebrationRig = {
  bloom: { strength: number };
  flare: { intensity: number };
  board: { rotation: { z: number } };
  camera: { position: { z: number } };
};

export type Celebration = {
  /** True while the moment is running. */
  readonly active: boolean;
  /** Opens the moment. */
  start(): void;
  /** How far a cell index lifts right now. */
  lift(index: number): number;
  /** Advances one frame at the board's resting camera distance. */
  step(dt: number, viewDistance: number): void;
  /** Snaps back to the resting pose, mid-moment if need be. */
  settle(viewDistance: number): void;
};

/**
 * The completion moment: a wave of lift spreading outward from the
 * centre of the finished board while the accent flare blows through the
 * bloom and the camera eases back to take the whole grid in.
 */
export function createCelebration(rig: CelebrationRig): Celebration {
  const state = { active: false, time: 0 };

  function settle(viewDistance: number) {
    state.active = false;
    state.time = 0;
    rig.bloom.strength = BLOOM_STRENGTH;
    rig.flare.intensity = 0;
    rig.board.rotation.z = 0;
    rig.camera.position.z = viewDistance;
  }

  return {
    get active() {
      return state.active;
    },
    start() {
      state.active = true;
      state.time = 0;
    },
    lift(index) {
      if (!state.active) return 0;
      const row = Math.floor(index / 9);
      const col = index % 9;
      const distance = Math.hypot(col - 4, row - 4) / 8;
      const wave = clamp01((state.time - distance) / LIFT_SPREAD);
      return Math.sin(wave * Math.PI) * LIFT_HEIGHT;
    },
    step(dt, viewDistance) {
      state.time += dt;
      const t = clamp01(state.time / DURATION);
      rig.bloom.strength = BLOOM_STRENGTH + Math.sin(t * Math.PI) * BLOOM_PEAK;
      rig.flare.intensity = 3 * (1 - t);
      rig.camera.position.z = viewDistance * (1 + easeOutCubic(t) * PULL_BACK);
      rig.board.rotation.z = Math.sin(t * Math.PI * 3) * SWAY * (1 - t);
      if (t >= 1) settle(viewDistance);
    },
    settle,
  };
}
