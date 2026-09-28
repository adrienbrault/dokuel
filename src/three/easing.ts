/** Clamps to the unit interval, for progress through an animation. */
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Decelerating curve: fast at first, settling at the end. */
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * Blend factor for chasing a target at a given rate.
 *
 * Exponential rather than a fixed step, so the same motion comes out of
 * a 60Hz laptop and a 120Hz phone without either looking faster.
 */
export const approach = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
