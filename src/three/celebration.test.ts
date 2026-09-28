import { describe, expect, it } from "vitest";
import { type CelebrationRig, createCelebration } from "./celebration.ts";
import { BLOOM_STRENGTH } from "./pipeline.ts";

const CENTRE = 4 * 9 + 4;
const CORNER = 0;

function rig(): CelebrationRig & { reads: () => number[] } {
  const bloom = { strength: BLOOM_STRENGTH };
  const flare = { intensity: 0 };
  const board = { rotation: { z: 0 } };
  const camera = { position: { z: 12 } };
  return {
    bloom,
    flare,
    board,
    camera,
    reads: () => [bloom.strength, flare.intensity, board.rotation.z],
  };
}

describe("createCelebration", () => {
  it("leaves the board alone until the moment starts", () => {
    const stage = rig();
    const moment = createCelebration(stage);

    expect(moment.active).toBe(false);
    expect(moment.lift(CENTRE)).toBe(0);
    expect(stage.reads()).toEqual([BLOOM_STRENGTH, 0, 0]);
  });

  it("lifts the centre of the board before its corners", () => {
    // The wave spreads outward from the middle, so the last cell to rise
    // is the one furthest from it.
    const moment = createCelebration(rig());

    moment.start();
    moment.step(0.3, 12);

    expect(moment.lift(CENTRE)).toBeGreaterThan(0);
    expect(moment.lift(CORNER)).toBe(0);
  });

  it("blows the flare and eases back, then comes to rest", () => {
    const stage = rig();
    const moment = createCelebration(stage);

    moment.start();
    moment.step(1.3, 12);

    expect(stage.bloom.strength).toBeGreaterThan(BLOOM_STRENGTH);
    expect(stage.flare.intensity).toBeGreaterThan(0);
    expect(stage.camera.position.z).toBeGreaterThan(12);
    expect(moment.active).toBe(true);

    moment.step(2, 12);

    expect(moment.active).toBe(false);
    expect(stage.reads()).toEqual([BLOOM_STRENGTH, 0, 0]);
    expect(stage.camera.position.z).toBe(12);
  });

  it("comes to rest at once when motion is taken away", () => {
    // A preference switch mid-moment must not leave the board wound up.
    const stage = rig();
    const moment = createCelebration(stage);

    moment.start();
    moment.step(0.4, 12);
    moment.settle(9);

    expect(moment.active).toBe(false);
    expect(stage.reads()).toEqual([BLOOM_STRENGTH, 0, 0]);
    expect(stage.camera.position.z).toBe(9);
  });
});
