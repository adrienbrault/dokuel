import { CanvasTexture, SRGBColorSpace } from "three";

/**
 * A soft round sprite shared by every particle system, so the board
 * allocates one texture instead of one per effect.
 */
export function createDotTexture(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const ctx = canvas.getContext("2d");
  if (!ctx) return texture;
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return texture;
}

/**
 * Film grain over the finished frame. Without it the smooth shaded
 * tiles read as a vector illustration; with a trace of it they read as
 * a photograph of a physical object.
 */
export const GRAIN_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0.022 },
    time: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float amount;
    uniform float time;
    varying vec2 vUv;
    void main() {
      vec4 colour = texture2D(tDiffuse, vUv);
      float seed = dot(vUv, vec2(12.9898, 78.233)) + time;
      float grain = fract(sin(seed) * 43758.5453) - 0.5;
      colour.rgb += grain * amount;
      gl_FragColor = colour;
    }
  `,
};

/**
 * The page behind the board. The canvas is opaque so bloom composites
 * cleanly, which means the backdrop has to reproduce the page's own
 * colour and then give it a floor: a slow breath of accent light rising
 * from beneath the slab, so the board stands in a room instead of
 * floating on a flat fill.
 */
export const BACKDROP_SHADER = {
  uniforms: {
    centre: { value: null },
    edge: { value: null },
    accent: { value: null },
    time: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 centre;
    uniform vec3 edge;
    uniform vec3 accent;
    uniform float time;
    varying vec2 vUv;
    void main() {
      vec2 fromCentre = vUv - 0.5;
      float distance = length(fromCentre);
      vec3 colour = mix(centre, edge, smoothstep(0.0, 0.72, distance));
      float floorLight = smoothstep(0.62, 1.0, vUv.y);
      float breath = 0.5 + 0.5 * sin(time * 0.35);
      colour += accent * floorLight * 0.16 * (0.6 + 0.4 * breath);
      gl_FragColor = vec4(colour, 1.0);
    }
  `,
};
