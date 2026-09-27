import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Mesh,
  NormalBlending,
  Points,
  ShaderMaterial,
  SphereGeometry,
} from "three";
import type { ScenePalette } from "./palette.ts";
import { FOG_GLSL, OUTPUT_GLSL } from "./shaders.ts";

/**
 * A dome behind everything: a gradient from horizon to zenith, a band
 * of glow where the floor disappears into fog, and on the dark theme a
 * field of slowly twinkling stars.
 */
export function createSky(palette: ScenePalette) {
  const uniforms = {
    uTime: { value: 0 },
    uZenith: { value: new Color() },
    uHorizon: { value: new Color() },
    uGlow: { value: new Color() },
    uStars: { value: 0 },
  };
  const material = new ShaderMaterial({
    uniforms: uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_Position.z = gl_Position.w; // pin to the far plane
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uGlow;
      uniform float uStars;
      varying vec3 vDir;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uZenith, smoothstep(-0.02, 0.6, h));
        col += uGlow * exp(-abs(h - 0.015) * 16.0) * 0.9;
        if (uStars > 0.0) {
          vec3 cell = floor(d * 240.0);
          float s = hash(cell);
          float r = length(fract(d * 240.0) - 0.5);
          float star = step(0.9965, s) * smoothstep(0.32, 0.0, r);
          float twinkle = 0.55 + 0.45 * sin(uTime * (0.8 + s * 2.4) + s * 60.0);
          col += vec3(0.75, 0.95, 1.0) * star * twinkle * smoothstep(0.04, 0.3, h) * uStars * 2.2;
        }
        gl_FragColor = vec4(col, 1.0);
        ${OUTPUT_GLSL}
      }
    `,
    side: BackSide,
    depthWrite: false,
    fog: false,
  });
  const geometry = new SphereGeometry(500, 48, 24);
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;

  function setPalette(p: ScenePalette) {
    uniforms.uZenith.value.copy(p.skyZenith);
    uniforms.uHorizon.value.copy(p.skyHorizon);
    uniforms.uGlow.value.copy(p.horizonGlow);
    uniforms.uStars.value = p.stars;
  }
  setPalette(palette);

  return {
    mesh,
    setPalette,
    update(time: number, cameraX: number, cameraY: number, cameraZ: number) {
      uniforms.uTime.value = time;
      // The dome follows the camera so it never gets any closer.
      mesh.position.set(cameraX, cameraY, cameraZ);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

const MOTE_HEIGHT = 14;

/**
 * Dust hanging in the light: points that rise, swirl around the board
 * and twinkle. A burst speeds them up for a moment on victory.
 */
export function createMotes(count: number, palette: ScenePalette) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = 2 + Math.sqrt(Math.random()) * 26;
    const a = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = Math.random() * MOTE_HEIGHT;
    positions[i * 3 + 2] = Math.sin(a) * r;
    seeds[i] = Math.random();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 1));

  const uniforms = {
    uTime: { value: 0 },
    uBurst: { value: 0 },
    uEnergy: { value: 1 },
    uPixelRatio: { value: 1 },
    uColor: { value: new Color() },
    uFogDensity: { value: 0.02 },
  };
  const material = new ShaderMaterial({
    uniforms: uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uBurst;
      uniform float uPixelRatio;
      uniform float uFogDensity;
      attribute float aSeed;
      varying float vAlpha;
      ${FOG_GLSL}
      void main() {
        vec3 p = position;
        float t = uTime * (0.12 + aSeed * 0.2);
        p.y = mod(p.y + t * 0.7 + uBurst * (2.0 + aSeed * 6.0), ${MOTE_HEIGHT.toFixed(1)});
        float ang = uTime * 0.02 * (1.0 + aSeed) + uBurst * aSeed * 1.5;
        float s = sin(ang);
        float c = cos(ang);
        p.xz = mat2(c, -s, s, c) * p.xz;
        p.x += sin(uTime * 0.4 + aSeed * 30.0) * 0.35;
        p.z += cos(uTime * 0.33 + aSeed * 21.0) * 0.35;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float depth = max(-mv.z, 0.5);
        gl_PointSize = min((0.6 + aSeed * 1.6) * uPixelRatio * (48.0 / depth), 28.0 * uPixelRatio);
        float edge = smoothstep(0.0, 1.5, p.y) * (1.0 - smoothstep(${(MOTE_HEIGHT - 2).toFixed(1)}, ${MOTE_HEIGHT.toFixed(1)}, p.y));
        float twinkle = 0.45 + 0.55 * sin(uTime * (1.2 + aSeed * 2.5) + aSeed * 40.0);
        // Motes right in front of the lens are out of focus: fade them.
        float nearFade = smoothstep(1.5, 5.0, depth);
        vAlpha = edge * twinkle * nearFade * (1.0 - fogFactor(depth, uFogDensity));
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uEnergy;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        a *= a * vAlpha * (0.4 + 0.6 * uEnergy);
        gl_FragColor = vec4(uColor * a, a);
        ${OUTPUT_GLSL}
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;

  function setPalette(p: ScenePalette) {
    uniforms.uColor.value.copy(p.mote);
    uniforms.uFogDensity.value = p.fogDensity;
    material.blending = p.additive ? AdditiveBlending : NormalBlending;
    material.premultipliedAlpha = true;
  }
  setPalette(palette);

  return {
    points,
    setPalette,
    update(time: number, burst: number, energy: number, pixelRatio: number) {
      uniforms.uTime.value = time;
      uniforms.uBurst.value = burst;
      uniforms.uEnergy.value = energy;
      uniforms.uPixelRatio.value = pixelRatio;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

/**
 * A column of light falling on the board from far above: an open cone
 * whose edges fade by view angle, streaked by slowly scrolling bands.
 */
export function createShaft(palette: ScenePalette) {
  const height = 36;
  const geometry = new CylinderGeometry(2.4, 6.2, height, 64, 1, true);
  geometry.translate(0, height / 2, 0);
  const uniforms = {
    uTime: { value: 0 },
    uIntensity: { value: 1 },
    uColor: { value: new Color() },
  };
  const material = new ShaderMaterial({
    uniforms: uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vFacing;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vFacing = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying float vFacing;
      void main() {
        float v = vUv.y;
        float vertical = smoothstep(0.0, 0.08, v) * pow(1.0 - v, 1.6);
        float streaks = 0.55
          + 0.25 * sin(vUv.x * 43.0 + uTime * 0.21 + sin(v * 5.0 + uTime * 0.3) * 1.5)
          + 0.2 * sin(vUv.x * 97.0 - uTime * 0.17);
        float edge = pow(vFacing, 2.5);
        float a = vertical * streaks * edge * uIntensity * 0.22;
        gl_FragColor = vec4(uColor * a, a);
        ${OUTPUT_GLSL}
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  const mesh = new Mesh(geometry, material);

  function setPalette(p: ScenePalette) {
    uniforms.uColor.value.copy(p.shaft);
  }
  setPalette(palette);

  return {
    mesh,
    setPalette,
    update(time: number, intensity: number) {
      uniforms.uTime.value = time;
      uniforms.uIntensity.value = intensity;
      mesh.visible = intensity > 0.01;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
