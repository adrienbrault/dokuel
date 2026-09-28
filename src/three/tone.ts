import { type Color, Color as ThreeColor } from "three";

/**
 * Exposure the output pass applies before the curve. The board's surfaces
 * are calibrated against this, so it lives beside the curve that reads it.
 */
export const TONE_EXPOSURE = 1.15;

/**
 * What a lit tile face returns into the HDR buffer.
 *
 * A surface's albedo is scaled by the rig before it reaches the curve, and
 * the rig is tuned so a near-white tile reads as its own token. That
 * settles the scale at about nine tenths - measured off the running board,
 * where a token at 254 lands at 245.
 */
export const SURFACE_REFLECTANCE = 0.92;

/** Where the curve stops being quadratic. Straight from the shader. */
const KNEE = 0.08;
const TOE = 6.25;
const OFFSET = 0.04;
const SHOULDER_START = 0.8 - OFFSET;
const SHOULDER_DROP = 1 - SHOULDER_START;
const DESATURATION = 0.15;

/**
 * The curve three ships as NeutralToneMapping, for one neutral channel.
 *
 * Below the knee it is quadratic, which is what pulls a near-black surface
 * down toward nothing; between the knee and the shoulder it subtracts a
 * flat offset; above the shoulder it rolls off toward white and eases the
 * colour toward grey as it goes.
 */
export function neutralOut(x: number, exposure = TONE_EXPOSURE): number {
  const v = x * exposure;
  const offset = v < KNEE ? v - TOE * v * v : OFFSET;
  const c = v - offset;
  if (c < SHOULDER_START) return c;
  const newPeak =
    1 - (SHOULDER_DROP * SHOULDER_DROP) / (c + SHOULDER_DROP - SHOULDER_START);
  const g = 1 - 1 / (DESATURATION * (c - newPeak) + 1);
  return c + (newPeak - c) * g;
}

/**
 * The albedo that makes a surface land on its own token.
 *
 * A token handed to a material is not what reaches the screen: the rig
 * scales it, then the curve bends it. Below the knee that bend is the toe,
 * quadratic, which swallows nearly everything - a tile at 18% lightness
 * arrives as charcoal. Between the knee and the shoulder it subtracts a
 * flat offset, which costs a mid tone a good few points. Both of those are
 * inverted here, exactly, because the curve takes its offset from the
 * darkest channel: adding the same offset back to every channel keeps the
 * channels' distances apart, so a crushed red lifts into red, not into mud.
 *
 * What the shoulder reaches is left to it. Pushing a near-white tile back
 * onto its token means handing the rig a value well over 1, and the bloom
 * reads that linear buffer - a board whose tiles clear the window blooms as
 * one flat sheet. The roll-off instead keeps a lit tile under it, so only
 * a mark ever throws a halo.
 */
export function toeCompensate(colour: Color): Color {
  const scale = SURFACE_REFLECTANCE * TONE_EXPOSURE;
  const target = Math.min(colour.r, colour.g, colour.b);
  if (target === 0 || target >= SHOULDER_START) return colour.clone();
  // The two branches meet at the knee with the same value, so the swap is
  // continuous and no surface lands on a step.
  const through = target < OFFSET ? Math.sqrt(target / TOE) : target + OFFSET;
  const offset = through < KNEE ? through - TOE * through * through : OFFSET;
  return new ThreeColor(
    (colour.r + offset) / scale,
    (colour.g + offset) / scale,
    (colour.b + offset) / scale,
  );
}
