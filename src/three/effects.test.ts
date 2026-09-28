import { Color, Group, SRGBColorSpace } from "three";
import { describe, expect, it } from "vitest";
import { createRingPool } from "./effects.ts";
import { BLOOM_THRESHOLD } from "./pipeline.ts";

/** Perceptual weight of a linear colour - what the bloom pass compares to. */
function luma(c: { r: number; g: number; b: number }) {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

function tone(hex: number): Color {
  return new Color().setHex(hex, SRGBColorSpace);
}

/** The material of the ring the pool just drew, wherever it came from. */
function drawn(parent: Group): Color[] {
  const emissives: Color[] = [];
  parent.traverse((child) => {
    const mesh = child as Group & {
      material?: { emissive?: Color; emissiveIntensity?: number };
    };
    if (mesh.material?.emissive && mesh.visible) {
      emissives.push(
        mesh.material.emissive
          .clone()
          .multiplyScalar(mesh.material.emissiveIntensity ?? 1),
      );
    }
  });
  return emissives;
}

describe("createRingPool", () => {
  it("spawns a ring that clears the bloom window", () => {
    // A ring flying out of a cell is the moment's whole punctuation; under
    // the threshold it expands as a dull outline instead of a flare.
    const parent = new Group();
    const pool = createRingPool(parent, tone(0x229c7c));
    pool.spawn(0, 0, tone(0x229c7c), 0.9);
    const glows = drawn(parent);
    expect(glows.length).toBeGreaterThan(0);
    for (const glow of glows)
      expect(luma(glow)).toBeGreaterThan(BLOOM_THRESHOLD);
    pool.dispose();
  });
});
