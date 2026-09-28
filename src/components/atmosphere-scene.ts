import type { Material, Texture } from "three";
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  FogExp2,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector2,
  WebGLRenderer,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type {
  AtmosphereDirector,
  AtmosphereRing,
  RingHue,
} from "../lib/atmosphere.ts";

/**
 * The WebGL world behind the UI: a breathing nebula backdrop, a glowing
 * horizon grid, drifting dust, ghostly floating digits, slow orbiting
 * orbs and event-driven pulse rings — all composited through bloom and
 * a filmic grade pass. Pure scene code; React wiring lives in
 * Atmosphere.tsx so this module stays testable and hot-reload friendly.
 */

type Vec3 = [number, number, number];

type Palette = {
  top: Vec3;
  bottom: Vec3;
  glow: Vec3;
  grid: Vec3;
  dust: Vec3;
  glyphColor: number;
  fogColor: number;
  fogDensity: number;
  bloomBase: number;
  bloomThreshold: number;
  grain: number;
};

const DARK_PALETTE: Palette = {
  top: [0.016, 0.02, 0.031],
  bottom: [0.027, 0.086, 0.09],
  glow: [0.24, 0.9, 0.76],
  grid: [0.14, 0.72, 0.6],
  dust: [0.62, 0.95, 0.88],
  glyphColor: 0x9fe4d2,
  fogColor: 0x05070b,
  fogDensity: 0.026,
  bloomBase: 0.5,
  bloomThreshold: 0.16,
  grain: 0.03,
};

const LIGHT_PALETTE: Palette = {
  top: [0.996, 0.99, 0.976],
  bottom: [0.826, 0.933, 0.902],
  glow: [0.04, 0.5, 0.4],
  grid: [0.05, 0.52, 0.44],
  dust: [0.16, 0.5, 0.44],
  glyphColor: 0x1f6f5f,
  fogColor: 0xfdfbf9,
  fogDensity: 0.018,
  bloomBase: 0.2,
  bloomThreshold: 0.78,
  grain: 0.012,
};

const FLASH_COLORS: Record<RingHue, Vec3> = {
  accent: [0.3, 0.95, 0.8],
  danger: [0.95, 0.22, 0.18],
  gold: [1.0, 0.76, 0.32],
};

const RING_HEX: Record<RingHue, number> = {
  accent: 0x4fd8bd,
  danger: 0xf03e34,
  gold: 0xffc457,
};

const NOISE_GLSL = /* glsl */ `
float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.55;
  for (int i = 0; i < 4; i++) {
    v += amp * vnoise(p);
    p = p * 2.03 + vec2(13.7, 7.3);
    amp *= 0.5;
  }
  return v;
}
`;

const PLANE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const NEBULA_FRAG = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uVictory;
uniform float uFlash;
uniform vec3 uFlashColor;
uniform vec3 uTop;
uniform vec3 uBottom;
uniform vec3 uGlow;
varying vec2 vUv;
${NOISE_GLSL}
void main() {
  vec2 p = vUv;
  float flow = fbm(vec2(p.x * 2.6, p.y * 1.8 - uTime * 0.021));
  float clouds = fbm(vec2(p.x * 1.4 + 31.0, p.y * 1.15 + uTime * 0.013));
  vec3 col = mix(uTop, uBottom, smoothstep(0.88, 0.0, p.y));
  float band = smoothstep(0.72, 0.08, p.y);
  col += uGlow * band * (0.045 + 0.14 * flow) *
    (0.65 + 0.55 * uEnergy + 0.95 * uVictory);
  col += uGlow * pow(clouds, 3.0) * (0.045 + 0.05 * uEnergy);
  float shaft = smoothstep(0.42, 0.62, flow) * smoothstep(0.15, 0.85, p.x);
  col += uGlow * shaft * 0.022 * (uEnergy + uVictory);
  col += uFlashColor * uFlash * 0.16;
  gl_FragColor = vec4(col, 1.0);
}
`;

const GRID_FRAG = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uVictory;
uniform vec3 uColor;
varying vec2 vUv;
float gridLine(vec2 uv, float scale) {
  vec2 g = abs(fract(uv * scale - 0.5) - 0.5) / fwidth(uv * scale);
  return 1.0 - min(min(g.x, g.y), 1.0);
}
void main() {
  vec2 uv = (vUv - 0.5) * 64.0;
  float fine = gridLine(uv, 0.25);
  float d = length(uv);
  float fade = smoothstep(27.0, 3.0, d);
  float pulse = 0.5 + 0.5 * sin(uTime * 0.9 - d * 0.42);
  float energy = 0.22 + 0.6 * uEnergy + 0.55 * uVictory * pulse;
  vec3 col = uColor * fine * fade * energy * 1.6;
  gl_FragColor = vec4(col, fine * fade * (0.42 + 0.58 * uEnergy));
}
`;

const DUST_VERT = /* glsl */ `
attribute float aSeed;
attribute float aSize;
uniform float uTime;
uniform float uPixelRatio;
varying float vTwinkle;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.22 + aSeed * 6.2831) * 0.7;
  p.y = mod(p.y + 4.0 + uTime * (0.12 + aSeed * 0.2), 15.0) - 4.0;
  p.z += cos(uTime * 0.18 + aSeed * 3.1415) * 0.5;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vTwinkle = 0.3 + 0.7 * pow(0.5 + 0.5 * sin(uTime * (1.2 + aSeed * 2.4) + aSeed * 9.0), 2.0);
  gl_PointSize = aSize * uPixelRatio * (17.0 / max(1.0, -mv.z));
  gl_Position = projectionMatrix * mv;
}
`;

const DUST_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uEnergy;
uniform float uVictory;
varying float vTwinkle;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.06, d);
  float intensity = 0.35 + 0.5 * uEnergy + 0.5 * uVictory;
  gl_FragColor = vec4(uColor * (0.7 + 0.6 * vTwinkle), a * vTwinkle * intensity);
}
`;

const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null as Texture | null },
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uFlashColor: { value: new Color(0x4fd8bd) },
    uGrain: { value: DARK_PALETTE.grain },
    uVignette: { value: 0.55 },
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
uniform float uTime;
uniform float uFlash;
uniform vec3 uFlashColor;
uniform float uGrain;
uniform float uVignette;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  float vig = smoothstep(1.35, 0.42, length((vUv - 0.5) * vec2(1.65, 1.22)));
  c.rgb *= mix(1.0, vig, uVignette);
  float grain = fract(sin(dot(vUv * vec2(1234.5, 987.2) + uTime,
    vec2(12.9898, 78.233))) * 43758.5453);
  c.rgb += (grain - 0.5) * uGrain;
  c.rgb += uFlashColor * uFlash * 0.2;
  gl_FragColor = c;
}
`,
};

export type Engine = {
  frame(dt: number, time: number): void;
  resize(width: number, height: number): void;
  setTheme(dark: boolean): void;
  setPointer(x: number, y: number): void;
  dispose(): void;
};

/** Hash-based handheld wobble — cheap, no per-frame garbage. */
const wobble = (t: number, seed: number): number =>
  Math.sin(t * (11.3 + seed * 7.7) + seed) * Math.cos(t * (2.1 + seed * 1.9));

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

function makeGlowTexture(size = 128): CanvasTexture | null {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = "srgb";
  return texture;
}

function makeDigitTexture(digit: number): CanvasTexture | null {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = "700 92px 'DM Sans', ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(String(digit), size / 2, size / 2 + 4);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = "srgb";
  return texture;
}

type RingSlot = {
  mesh: Mesh;
  material: MeshBasicMaterial;
  age: number;
  strength: number;
};

type Glyph = {
  sprite: Sprite;
  baseY: number;
  speed: number;
  phase: number;
  drift: number;
};

type Orb = {
  sprite: Sprite;
  phase: number;
  radius: number;
  y: number;
};

export function createEngine(
  container: HTMLElement,
  director: AtmosphereDirector,
): Engine {
  const renderer = new WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.outputColorSpace = "srgb";
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.display = "block";
  container.appendChild(renderer.domElement);

  // Adaptive resolution: software rasterizers and weak integrated GPUs
  // cannot hold 60fps at full resolution. We watch a smoothed frame time
  // and, once, halve both the canvas buffer and the post-processing
  // render targets when the machine proves it is falling behind. This
  // keeps interaction and bloom alive instead of letting the whole
  // world stall waiting on the GPU.
  let frameMs = 16.7;
  let framesSeen = 0;
  let degradeScale = 1;
  const measurePerformance = (dt: number) => {
    frameMs += (dt * 1000 - frameMs) * 0.1;
    framesSeen++;
    if (degradeScale === 1 && framesSeen > 24 && frameMs > 33) {
      degradeScale = 0.5;
      const ratio = Math.max(1, pixelRatio * degradeScale);
      renderer.setPixelRatio(ratio);
      dustUniforms.uPixelRatio.value = ratio;
      composer.setSize(
        window.innerWidth * degradeScale,
        window.innerHeight * degradeScale,
      );
    }
  };

  const scene = new Scene();
  scene.fog = new FogExp2(DARK_PALETTE.fogColor, DARK_PALETTE.fogDensity);
  const camera = new PerspectiveCamera(
    55,
    window.innerWidth / Math.max(1, window.innerHeight),
    0.1,
    120,
  );
  camera.position.set(0, 1.2, 10);

  const disposables: { dispose(): void }[] = [];

  // ── Backdrop nebula (fullscreen, never lit, never fogged) ──────────
  const bgUniforms = {
    uTime: { value: 0 },
    uEnergy: { value: 0 },
    uVictory: { value: 0 },
    uFlash: { value: 0 },
    uFlashColor: { value: new Color() },
    uTop: { value: new Color() },
    uBottom: { value: new Color() },
    uGlow: { value: new Color() },
  };
  const backdrop = new Mesh(
    new PlaneGeometry(1, 1),
    new ShaderMaterial({
      uniforms: bgUniforms,
      vertexShader: PLANE_VERT,
      fragmentShader: NEBULA_FRAG,
      depthWrite: false,
    }),
  );
  backdrop.renderOrder = -100;
  backdrop.frustumCulled = false;
  scene.add(backdrop);

  // ── Horizon grid ────────────────────────────────────────────────────
  const gridUniforms = {
    uTime: { value: 0 },
    uEnergy: { value: 0 },
    uVictory: { value: 0 },
    uColor: { value: new Color() },
  };
  const grid = new Mesh(
    new PlaneGeometry(140, 140),
    new ShaderMaterial({
      uniforms: gridUniforms,
      vertexShader: PLANE_VERT,
      fragmentShader: GRID_FRAG,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  grid.rotation.x = -Math.PI / 2;
  grid.position.set(0, -6.5, -14);
  scene.add(grid);

  // ── Drifting dust ───────────────────────────────────────────────────
  const DUST_COUNT = 850;
  const dustPositions = new Float32Array(DUST_COUNT * 3);
  const dustSeeds = new Float32Array(DUST_COUNT);
  const dustSizes = new Float32Array(DUST_COUNT);
  for (let i = 0; i < DUST_COUNT; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 46;
    dustPositions[i * 3 + 1] = Math.random() * 12 - 4;
    dustPositions[i * 3 + 2] = -42 + Math.random() * 48;
    dustSeeds[i] = Math.random();
    dustSizes[i] = 1.2 + Math.random() * 3.4;
  }
  const dustGeometry = new BufferGeometry();
  dustGeometry.setAttribute("position", new BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute("aSeed", new BufferAttribute(dustSeeds, 1));
  dustGeometry.setAttribute("aSize", new BufferAttribute(dustSizes, 1));
  const dustUniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: pixelRatio },
    uEnergy: { value: 0 },
    uVictory: { value: 0 },
    uColor: { value: new Color() },
  };
  const dust = new Points(
    dustGeometry,
    new ShaderMaterial({
      uniforms: dustUniforms,
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  scene.add(dust);

  // ── Ghostly floating digits ─────────────────────────────────────────
  const glyphTextures: CanvasTexture[] = [];
  const glyphs: Glyph[] = [];
  for (let i = 0; i < 16; i++) {
    const texture = makeDigitTexture(1 + (i % 9));
    if (texture) glyphTextures.push(texture);
    const material = new SpriteMaterial({
      map: texture,
      color: DARK_PALETTE.glyphColor,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      opacity: 0.16,
    });
    const sprite = new Sprite(material);
    const scale = 0.9 + Math.random() * 2.4;
    sprite.scale.set(scale, scale, 1);
    const baseY = Math.random() * 11 - 4;
    sprite.position.set(
      (Math.random() - 0.5) * 34,
      baseY,
      -34 + Math.random() * 22,
    );
    scene.add(sprite);
    glyphs.push({
      sprite,
      baseY,
      speed: 0.05 + Math.random() * 0.12,
      phase: Math.random() * Math.PI * 2,
      drift: 0.5 + Math.random() * 1.2,
    });
  }

  // ── Slow-orbiting glow orbs ─────────────────────────────────────────
  const glowTexture = makeGlowTexture();
  if (glowTexture) disposables.push(glowTexture);
  const orbs: Orb[] = [];
  const orbColors = [0x3fd8b8, 0xffc457, 0x7f8cff];
  for (let i = 0; i < 3; i++) {
    const material = new SpriteMaterial({
      map: glowTexture,
      color: orbColors[i] ?? 0xffffff,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      opacity: 0.32,
    });
    const sprite = new Sprite(material);
    const scale = 6 + i * 3;
    sprite.scale.set(scale, scale, 1);
    scene.add(sprite);
    orbs.push({
      sprite,
      phase: (i / 3) * Math.PI * 2,
      radius: 7 + i * 4,
      y: -1 + i * 2.2,
    });
  }

  // ── Pulse rings (event pool) ────────────────────────────────────────
  const ringGeometry = new TorusGeometry(1, 0.035, 8, 72);
  disposables.push(ringGeometry);
  const ringPool: RingSlot[] = [];
  for (let i = 0; i < 10; i++) {
    const material = new MeshBasicMaterial({
      color: RING_HEX.accent,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new Mesh(ringGeometry, material);
    mesh.rotation.x = -0.55;
    mesh.position.set(0, 0.4, -3);
    mesh.visible = false;
    scene.add(mesh);
    ringPool.push({ mesh, material, age: -1, strength: 0 });
  }
  let ringCursor = 0;

  const spawnRing = (ring: AtmosphereRing) => {
    const slot = ringPool[ringCursor % ringPool.length];
    if (!slot) return;
    ringCursor++;
    slot.age = 0;
    slot.strength = ring.strength;
    slot.material.color.setHex(RING_HEX[ring.hue]);
    slot.mesh.visible = true;
    slot.mesh.scale.set(0.2, 0.2, 0.2);
    slot.material.opacity = 0.85 * ring.strength;
  };

  // ── Post chain: bloom → grade → output ──────────────────────────────
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new Vector2(window.innerWidth, window.innerHeight),
    DARK_PALETTE.bloomBase,
    0.85,
    DARK_PALETTE.bloomThreshold,
  );
  composer.addPass(bloom);
  const grade = new ShaderPass(GRADE_SHADER);
  const gradeUniforms = grade.uniforms as {
    uTime: { value: number };
    uGrain: { value: number };
    uFlash: { value: number };
    uFlashColor: { value: Color };
  };
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  let dark = true;
  let pointerX = 0;
  let pointerY = 0;
  let cameraX = 0;
  let cameraY = 1.2;
  let cameraZ = 10;

  // The camera drifts with mood and shake, so the backdrop must be
  // re-fitted every frame against the live frustum — measuring from
  // its own depth leaves the plane's edges visible as a hard rectangle.
  const BACKDROP_DEPTH = 40;
  const fitBackdrop = () => {
    const distance = camera.position.z + BACKDROP_DEPTH;
    const h = 2 * Math.tan((camera.fov * Math.PI) / 360) * distance;
    backdrop.scale.set(h * camera.aspect * 1.3, h * 1.3, 1);
  };
  backdrop.position.set(0, 0, -BACKDROP_DEPTH);

  const resize = (width: number, height: number) => {
    renderer.setSize(width, height);
    composer.setSize(width * degradeScale, height * degradeScale);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    fitBackdrop();
  };
  resize(window.innerWidth, window.innerHeight);

  const setTheme = (isDark: boolean) => {
    dark = isDark;
    const p = isDark ? DARK_PALETTE : LIGHT_PALETTE;
    bgUniforms.uTop.value.setRGB(...p.top);
    bgUniforms.uBottom.value.setRGB(...p.bottom);
    bgUniforms.uGlow.value.setRGB(...p.glow);
    gridUniforms.uColor.value.setRGB(...p.grid);
    dustUniforms.uColor.value.setRGB(...p.dust);
    gradeUniforms.uGrain.value = p.grain;
    const fog = scene.fog;
    if (fog && "density" in fog) {
      fog.color.setHex(p.fogColor);
      fog.density = p.fogDensity;
    }
    for (const glyph of glyphs) {
      glyph.sprite.material.color.setHex(p.glyphColor);
    }
  };

  const updateBackdrop = (
    s: ReturnType<AtmosphereDirector["read"]>,
    time: number,
  ) => {
    bgUniforms.uTime.value = time;
    bgUniforms.uEnergy.value = s.ambient * 0.5 + s.energy;
    bgUniforms.uVictory.value = s.victory;
    bgUniforms.uFlash.value = s.flash;
    bgUniforms.uFlashColor.value.setRGB(...FLASH_COLORS[s.flashHue]);
    gridUniforms.uTime.value = time;
    gridUniforms.uEnergy.value = s.ambient * 0.4 + s.energy;
    gridUniforms.uVictory.value = s.victory;
    dustUniforms.uTime.value = time;
    dustUniforms.uEnergy.value = s.ambient * 0.6 + s.energy;
    dustUniforms.uVictory.value = s.victory;
  };

  const updateGlyphs = (
    s: ReturnType<AtmosphereDirector["read"]>,
    dt: number,
    time: number,
  ) => {
    for (const g of glyphs) {
      g.sprite.position.y =
        g.baseY + Math.sin(time * g.speed + g.phase) * g.drift;
      g.sprite.material.rotation += dt * 0.06;
      g.sprite.material.opacity =
        (dark ? 0.13 : 0.1) * (0.7 + 0.8 * s.ambient + 0.9 * s.victory);
    }
    for (const orb of orbs) {
      const a = orb.phase + time * 0.06;
      orb.sprite.position.set(
        Math.cos(a) * orb.radius,
        orb.y + Math.sin(time * 0.2 + orb.phase) * 0.8,
        -12 + Math.sin(a) * orb.radius * 0.4,
      );
      orb.sprite.material.opacity =
        (dark ? 0.3 : 0.14) * (0.55 + 0.5 * s.ambient + 0.7 * s.victory);
    }
  };

  const updateRings = (s: AtmosphereRing[] | null, dt: number) => {
    if (s) for (const ring of s) spawnRing(ring);
    for (const slot of ringPool) {
      if (slot.age < 0) continue;
      slot.age += dt;
      const life = slot.age / 1.5;
      if (life >= 1) {
        slot.age = -1;
        slot.mesh.visible = false;
        slot.material.opacity = 0;
        continue;
      }
      const scale = 0.2 + life * (4.5 + slot.strength * 5.5);
      slot.mesh.scale.set(scale, scale, scale);
      slot.material.opacity = 0.85 * slot.strength * (1 - life) ** 2;
    }
  };

  const updateCamera = (
    mood: ReturnType<AtmosphereDirector["read"]>["mood"],
    shake: number,
    dt: number,
    time: number,
  ) => {
    const k = 1 - Math.exp(-dt * 2.4);
    cameraX = lerp(cameraX, pointerX * 1.35, k);
    cameraY = lerp(cameraY, 1.2 - pointerY * 0.85, k);
    cameraZ = lerp(
      cameraZ,
      mood === "game" ? 8.6 : 10,
      1 - Math.exp(-dt * 1.2),
    );
    const trauma = shake * shake;
    camera.position.set(
      cameraX + trauma * 0.55 * wobble(time * 13, 1),
      cameraY + trauma * 0.45 * wobble(time * 11, 2),
      cameraZ + trauma * 0.3 * wobble(time * 17, 3),
    );
    camera.rotation.z = trauma * 0.02 * wobble(time * 15, 4);
  };

  const frame = (dt: number, time: number) => {
    const s = director.read();
    measurePerformance(dt);
    updateBackdrop(s, time);
    updateGlyphs(s, dt, time);
    updateRings(director.takeRings(), dt);
    updateCamera(s.mood, s.shake, dt, time);
    fitBackdrop();

    bloom.strength =
      (dark ? DARK_PALETTE.bloomBase : LIGHT_PALETTE.bloomBase) +
      s.ambient * 0.5 +
      s.energy * 0.85 +
      s.victory * 0.9;
    bloom.threshold = dark
      ? DARK_PALETTE.bloomThreshold
      : LIGHT_PALETTE.bloomThreshold;
    gradeUniforms.uTime.value = time;
    gradeUniforms.uFlash.value = s.flash;
    gradeUniforms.uFlashColor.value.setRGB(...FLASH_COLORS[s.flashHue]);

    composer.render(dt);
  };

  const dispose = () => {
    scene.traverse((object) => {
      const mesh = object as Partial<{
        geometry: { dispose(): void };
        material: Material;
      }>;
      mesh.geometry?.dispose();
      mesh.material?.dispose();
    });
    for (const d of disposables) d.dispose();
    for (const texture of glyphTextures) texture.dispose();
    composer.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };

  return {
    frame,
    resize,
    setTheme,
    setPointer: (x, y) => {
      pointerX = x;
      pointerY = y;
    },
    dispose,
  };
}
