import {
  Color,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector4,
} from "three";
import type { ScenePalette } from "./palette.ts";
import { COMPOSITE_GLSL, FOG_GLSL, OUTPUT_GLSL } from "./shaders.ts";

const MAX_RIPPLES = 16;
const MAX_SWEEPS = 8;

/**
 * The ground: an endless field of sudoku boards drawn in light. The
 * board at the origin is the player's (cell r,c sits at x=c-4, z=r-4);
 * the one to the north (z=-9) is where the rival's moves show up.
 * Ripples run out of cells as values land; sweeps wash across units as
 * they complete.
 */
export function createFloor(palette: ScenePalette) {
  const ripples = Array.from({ length: MAX_RIPPLES }, () => new Vector4());
  const rippleColors = Array.from({ length: MAX_RIPPLES }, () => new Color());
  const sweeps = Array.from({ length: MAX_SWEEPS }, () => new Vector4());
  const sweepInfo = Array.from({ length: MAX_SWEEPS }, () => new Vector2());
  const sweepColors = Array.from({ length: MAX_SWEEPS }, () => new Color());
  // Parked far in the past so empty slots never draw.
  for (const r of ripples) r.set(0, 0, -1e4, 0);
  for (const s of sweepInfo) s.set(-1e4, 0);

  const uniforms = {
    uTime: { value: 0 },
    uEnergy: { value: 1 },
    uProgress: { value: 0 },
    uAdditive: { value: 1 },
    uGridGain: { value: 1 },
    uBase: { value: new Color() },
    uMinor: { value: new Color() },
    uMajor: { value: new Color() },
    uAccent: { value: new Color() },
    uFog: { value: new Color() },
    uHorizon: { value: new Color() },
    uFogDensity: { value: 0.02 },
    uRipples: { value: ripples },
    uRippleColors: { value: rippleColors },
    uSweeps: { value: sweeps },
    uSweepInfo: { value: sweepInfo },
    uSweepColors: { value: sweepColors },
  };
  const material = new ShaderMaterial({
    uniforms: uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uEnergy;
      uniform float uProgress;
      uniform float uGridGain;
      uniform vec3 uBase;
      uniform vec3 uMinor;
      uniform vec3 uMajor;
      uniform vec3 uAccent;
      uniform vec3 uFog;
      uniform vec3 uHorizon;
      uniform float uFogDensity;
      uniform vec4 uRipples[${MAX_RIPPLES}];
      uniform vec3 uRippleColors[${MAX_RIPPLES}];
      uniform vec4 uSweeps[${MAX_SWEEPS}];
      uniform vec2 uSweepInfo[${MAX_SWEEPS}];
      uniform vec3 uSweepColors[${MAX_SWEEPS}];
      varying vec3 vWorld;
      ${FOG_GLSL}
      ${COMPOSITE_GLSL}

      // Anti-aliased grid lines, a constant width in pixels, faded out
      // where they would crowd into moire at a distance.
      float grid(vec2 coord, float px) {
        vec2 w = fwidth(coord);
        vec2 d = abs(fract(coord - 0.5) - 0.5) / max(w, vec2(1e-4));
        float line = 1.0 - smoothstep(px * 0.5, px * 0.5 + 1.0, min(d.x, d.y));
        return line * (1.0 - smoothstep(0.12, 0.4, max(w.x, w.y)));
      }

      void main() {
        vec2 p = vWorld.xz;
        vec2 q = p + 4.5;
        float minor = grid(q, 1.0);
        float major = grid(q / 3.0, 1.8);
        float board = grid(q / 9.0, 2.6);
        float lineMask = max(minor * 0.5, max(major, board));

        float dist = length(p);
        float falloff = exp(-dist * 0.05);
        // The two boards that matter: the player's, and the rival's to
        // the north. The rest of the field is barely etched.
        float home = 1.0 - smoothstep(4.6, 6.5, max(abs(p.x), abs(p.y)));
        float rivalBoard = 1.0 - smoothstep(4.6, 6.5, max(abs(p.x), abs(p.y + 9.0)));
        float boards = max(home, rivalBoard * 0.6);
        // Lines right under the lens would be out of focus: soften them.
        float camDist = length(cameraPosition - vWorld);
        float focus = smoothstep(3.0, 12.0, camDist);

        vec3 col = uBase;
        // A pool of light under the player's board that deepens as the
        // board fills.
        float pool = exp(-dot(p, p) * 0.018);
        col = composite(col, uAccent, pool * (0.05 + 0.08 * uEnergy + 0.18 * uProgress) * uAdditive);

        float gridLevel = (0.3 + 0.7 * uEnergy) * (falloff * 0.35 + boards) * focus * uGridGain;
        col = composite(col, uMinor, minor * 0.55 * gridLevel);
        col = composite(col, uMajor, max(major * 0.7, board) * gridLevel * (0.75 + 0.25 * uProgress));

        // Effects accumulate into one light, then get soft-clamped: a
        // late-game move can close a row, a column and a box at once,
        // and stacked glows must stay a highlight, not a white-out.
        vec3 fx = vec3(0.0);

        // Ripples: a ring that lights the grid lines as it passes, and a
        // brief glow filling the cell it started from.
        for (int i = 0; i < ${MAX_RIPPLES}; i++) {
          vec4 r = uRipples[i];
          float age = uTime - r.z;
          if (age < 0.0 || age > 3.5 || r.w <= 0.0) continue;
          vec2 dp = p - r.xy;
          float d = length(dp);
          float radius = age * 5.0;
          float width = 0.3 + age * 0.4;
          float ring = exp(-pow((d - radius) / width, 2.0)) * exp(-age * 1.4);
          vec2 cd = abs(dp);
          float cell = (1.0 - smoothstep(0.36, 0.5, max(cd.x, cd.y))) * exp(-age * 2.5);
          fx += uRippleColors[i] * r.w * (ring * (0.03 + lineMask * 0.55) + cell * 0.35);
        }

        // Sweeps: a completed row/column/box glows, and a bright band
        // runs along it.
        for (int i = 0; i < ${MAX_SWEEPS}; i++) {
          vec2 info = uSweepInfo[i];
          float age = uTime - info.x;
          if (age < 0.0 || age > 3.0 || info.y <= 0.0) continue;
          vec4 b = uSweeps[i];
          vec2 c = (b.xy + b.zw) * 0.5;
          vec2 h = (b.zw - b.xy) * 0.5;
          vec2 o = abs(p - c) - h;
          float outside = length(max(o, 0.0));
          float inside = 1.0 - step(0.0, max(o.x, o.y));
          float along = h.x >= h.y
            ? (p.x - b.x) / max(b.z - b.x, 1e-3)
            : (p.y - b.y) / max(b.w - b.y, 1e-3);
          float band = exp(-pow((along - age * 1.4 + 0.1) * 6.0, 2.0)) * inside;
          float glow = (inside * 0.07 + exp(-outside * 3.0) * 0.05) * exp(-age * 1.6);
          fx += uSweepColors[i] * info.y * (glow * (0.4 + lineMask * 1.5) + band * 0.35);
        }

        float fxLevel = max(fx.r, max(fx.g, fx.b));
        float fxCapped = fxLevel / (1.0 + fxLevel * 0.8);
        if (fxLevel > 1e-4) {
          col = composite(col, fx / fxLevel, fxCapped);
        }

        // Grazing angles pick up the horizon, like a polished floor.
        vec3 toCam = cameraPosition - vWorld;
        float graze = pow(1.0 - abs(normalize(toCam).y), 5.0);
        col = mix(col, uHorizon, graze * 0.35);

        col = mix(col, uFog, fogFactor(length(toCam), uFogDensity));
        gl_FragColor = vec4(col, 1.0);
        ${OUTPUT_GLSL}
      }
    `,
  });

  const geometry = new PlaneGeometry(700, 700);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geometry, material);

  let nextRipple = 0;
  let nextSweep = 0;

  function setPalette(p: ScenePalette) {
    uniforms.uBase.value.copy(p.floorBase);
    uniforms.uMinor.value.copy(p.gridMinor);
    uniforms.uMajor.value.copy(p.gridMajor);
    uniforms.uAccent.value.copy(p.accent);
    uniforms.uFog.value.copy(p.fog);
    uniforms.uHorizon.value.copy(p.horizonGlow);
    uniforms.uFogDensity.value = p.fogDensity;
    uniforms.uGridGain.value = p.gridGain;
    uniforms.uAdditive.value = p.additive ? 1 : 0;
  }
  setPalette(palette);

  return {
    mesh,
    setPalette,
    update(time: number, energy: number, progress: number) {
      uniforms.uTime.value = time;
      uniforms.uEnergy.value = energy;
      uniforms.uProgress.value = progress;
    },
    ripple(x: number, z: number, color: Color, strength: number, at: number) {
      ripples[nextRipple]?.set(x, z, at, strength);
      rippleColors[nextRipple]?.copy(color);
      nextRipple = (nextRipple + 1) % MAX_RIPPLES;
    },
    sweep(
      rect: [minX: number, minZ: number, maxX: number, maxZ: number],
      color: Color,
      strength: number,
      at: number,
    ) {
      sweeps[nextSweep]?.set(...rect);
      sweepInfo[nextSweep]?.set(at, strength);
      sweepColors[nextSweep]?.copy(color);
      nextSweep = (nextSweep + 1) % MAX_SWEEPS;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
