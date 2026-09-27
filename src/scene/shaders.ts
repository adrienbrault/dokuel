/**
 * GLSL shared by the scene's custom materials. Every material ends with
 * three's tone mapping + color space chunks, so it renders correctly both
 * into the post-processing target (linear) and straight to screen.
 */

export const FOG_GLSL = /* glsl */ `
  float fogFactor(float dist, float density) {
    return 1.0 - exp(-density * density * dist * dist);
  }
`;

/**
 * Additive glow on a dark world, ink-style blend on a light one: the
 * same effect code works in both themes.
 */
export const COMPOSITE_GLSL = /* glsl */ `
  uniform float uAdditive;
  vec3 composite(vec3 base, vec3 light, float amount) {
    vec3 added = base + light * amount;
    vec3 inked = mix(base, light, clamp(amount, 0.0, 1.0));
    return mix(inked, added, uAdditive);
  }
`;

export const OUTPUT_GLSL = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;
