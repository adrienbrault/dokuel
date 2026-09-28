import { Color, SRGBColorSpace } from "three";
import { describe, expect, it } from "vitest";
import {
  neutralOut,
  SURFACE_REFLECTANCE,
  TONE_EXPOSURE,
  toeCompensate,
} from "./tone.ts";

/** sRGB-encoded channels, as the design tokens arrive, into linear. */
function linearOf(r: number, g: number, b: number): Color {
  return new Color().setRGB(r, g, b, SRGBColorSpace);
}

/** What a lit surface hands back after the curve, given its albedo. */
function lit(colour: Color): Color {
  const scale = SURFACE_REFLECTANCE * TONE_EXPOSURE;
  return new Color(
    neutralOut(colour.r * scale),
    neutralOut(colour.g * scale),
    neutralOut(colour.b * scale),
  );
}

describe("tone", () => {
  it("mirrors the curve three ships as NeutralToneMapping", () => {
    // Hand-computed from the shader at exposure 1: below the 0.08 knee the
    // curve is quadratic (out = 6.25x²), between the knee and the shoulder
    // it subtracts a flat 0.04, above it rolls off toward 1.
    expect(neutralOut(0.02, 1)).toBeCloseTo(6.25 * 0.02 * 0.02, 6);
    expect(neutralOut(0.5, 1)).toBeCloseTo(0.46, 6);
    expect(neutralOut(0.9, 1)).toBeCloseTo(0.86, 2);
  });

  it("lands a near-black tile on its own token", () => {
    // --color-cell-bg in dark mode: oklch(18% .006 80), the surface the
    // board is built from. Handed to the curve raw it crushes to almost
    // nothing, which is why a dark board's tiles read as charcoal.
    const token = linearOf(0.0744, 0.068, 0.0575);
    const compensated = toeCompensate(token);
    const landed = lit(compensated);
    expect(landed.r).toBeCloseTo(token.r, 3);
    expect(landed.g).toBeCloseTo(token.g, 3);
    expect(landed.b).toBeCloseTo(token.b, 3);
  });

  it("leaves a near-white tile to the shoulder", () => {
    // The shoulder's roll-off is what keeps a fully lit tile under the
    // bloom window. Lifting it into high dynamic range would bloom the
    // whole board as one flat sheet, so a bright token is left alone.
    const token = linearOf(0.9977, 0.993, 0.985);
    const compensated = toeCompensate(token);
    expect(compensated.r).toBeCloseTo(token.r, 6);
    expect(compensated.g).toBeCloseTo(token.g, 6);
    expect(compensated.b).toBeCloseTo(token.b, 6);
  });

  it("keeps the order of two dark tokens", () => {
    const darker = toeCompensate(linearOf(0.05, 0.05, 0.05));
    const lighter = toeCompensate(linearOf(0.09, 0.09, 0.09));
    expect(darker.r).toBeLessThan(lighter.r);
  });

  it("lifts a crushed ink without inventing a hue", () => {
    // --color-cell-conflict: a red whose blue channel sits under the knee.
    const ink = linearOf(0.69, 0.29, 0.227);
    const compensated = toeCompensate(ink);
    expect(compensated.b).toBeGreaterThan(ink.b);
    expect(compensated.r).toBeGreaterThan(ink.r);
    // Every channel gains the same offset, so the hue is untouched.
    expect(compensated.r - ink.r).toBeCloseTo(compensated.b - ink.b, 6);
  });

  it("leaves pure black alone", () => {
    const black = toeCompensate(new Color(0, 0, 0));
    expect(black.r).toBe(0);
    expect(black.g).toBe(0);
    expect(black.b).toBe(0);
  });
});
