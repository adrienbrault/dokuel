import { Color, SRGBColorSpace } from "three";
import { describe, expect, it } from "vitest";
import { BLOOM_THRESHOLD, markGlow } from "./pipeline.ts";

/** Perceptual weight of a linear colour - what the bloom pass compares to. */
function luma(c: { r: number; g: number; b: number }) {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

describe("markGlow", () => {
  it("lifts a mid-tone mark past the bloom window", () => {
    // The accent is a mid green, so an intensity chosen by eye leaves it
    // under the threshold and the selection ring draws with no halo at all.
    const accent = new Color().setHex(0x229c7c, SRGBColorSpace);
    expect(luma(accent) * markGlow(accent)).toBeGreaterThan(BLOOM_THRESHOLD);
  });

  it("keeps a bright mark from blowing out", () => {
    // A white spark is already at the top of the window, so the same
    // multiplier that suits the accent would leave it a featureless blob.
    expect(markGlow(new Color(1, 1, 1))).toBeLessThan(2);
  });

  it("survives a colour with no luminance", () => {
    expect(Number.isFinite(markGlow(new Color(0, 0, 0)))).toBe(true);
  });
});
