import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  NormalBlending,
  Points,
  ShaderMaterial,
} from "three";

const MAX = 900;

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aShape;
  attribute float aSpin;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying float vShape;
  varying float vSpin;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vShape = aShape;
    vSpin = aSpin;
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying float vShape;
  varying float vSpin;
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float a;
    if (vShape < 0.5) {
      // Soft glowing spark.
      float d = length(p);
      a = smoothstep(0.5, 0.0, d);
      a *= a;
    } else {
      // Confetti: a spinning rectangle, squashed to fake a tumble.
      float c = cos(vSpin), s = sin(vSpin);
      vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
      q.y /= max(abs(cos(vSpin * 1.7)), 0.25) * 0.55;
      a = step(abs(q.x), 0.42) * step(abs(q.y), 0.42);
    }
    if (a * vAlpha < 0.01) discard;
    gl_FragColor = vec4(vColor, a * vAlpha);
    #include <colorspace_fragment>
  }
`;

type Particle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  shape: number;
  spin: number;
  spinV: number;
  gravity: number;
  drag: number;
  color: Color;
};

export type EmitOptions = {
  x: number;
  y: number;
  z?: number;
  count: number;
  colors: Color[];
  speed: number;
  size: number;
  life: number;
  shape?: "spark" | "confetti";
  gravity?: number;
  /** Extra upward (toward camera) kick. */
  lift?: number;
  spread?: number;
};

/** A fixed pool of CPU-simulated point sprites: sparks and confetti. */
export class Particles {
  readonly points: Points;
  private particles: Particle[] = [];
  private geometry = new BufferGeometry();
  private material: ShaderMaterial;
  private positions = new Float32Array(MAX * 3);
  private colors = new Float32Array(MAX * 3);
  private sizes = new Float32Array(MAX);
  private alphas = new Float32Array(MAX);
  private shapes = new Float32Array(MAX);
  private spins = new Float32Array(MAX);

  constructor(pixelRatio: number, additive: boolean) {
    const attr = (array: Float32Array, size: number) =>
      new BufferAttribute(array, size).setUsage(DynamicDrawUsage);
    this.geometry.setAttribute("position", attr(this.positions, 3));
    this.geometry.setAttribute("aColor", attr(this.colors, 3));
    this.geometry.setAttribute("aSize", attr(this.sizes, 1));
    this.geometry.setAttribute("aAlpha", attr(this.alphas, 1));
    this.geometry.setAttribute("aShape", attr(this.shapes, 1));
    this.geometry.setAttribute("aSpin", attr(this.spins, 1));
    this.geometry.setDrawRange(0, 0);
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uPixelRatio: { value: pixelRatio } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: additive ? AdditiveBlending : NormalBlending,
    });
    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  setBlending(additive: boolean) {
    this.material.blending = additive ? AdditiveBlending : NormalBlending;
  }

  get alive(): boolean {
    return this.particles.length > 0;
  }

  emit(o: EmitOptions) {
    const confetti = o.shape === "confetti";
    for (let i = 0; i < o.count; i++) {
      if (this.particles.length >= MAX) this.particles.shift();
      const angle = Math.random() * Math.PI * 2;
      const speed = o.speed * (0.35 + Math.random() * 0.65);
      const spread = o.spread ?? 0;
      this.particles.push({
        x: o.x + (Math.random() - 0.5) * spread,
        y: o.y + (Math.random() - 0.5) * spread,
        z: o.z ?? 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: (o.lift ?? 0) * (0.5 + Math.random()),
        life: 0,
        maxLife: o.life * (0.6 + Math.random() * 0.4),
        size: o.size * (0.6 + Math.random() * 0.6),
        shape: confetti ? 1 : 0,
        spin: Math.random() * Math.PI * 2,
        spinV: (Math.random() - 0.5) * 14,
        gravity: o.gravity ?? 0,
        drag: confetti ? 1.4 : 3.2,
        color:
          o.colors[Math.floor(Math.random() * o.colors.length)] ??
          new Color(1, 1, 1),
      });
    }
  }

  update(dt: number) {
    const list = this.particles;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i]!;
      p.life += dt;
      if (p.life >= p.maxLife) continue;
      const damp = Math.exp(-p.drag * dt);
      p.vx *= damp;
      p.vy = p.vy * damp - p.gravity * dt;
      p.vz *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.spin += p.spinV * dt;
      list[w++] = p;
    }
    list.length = w;

    for (let i = 0; i < w; i++) {
      const p = list[i]!;
      const t = p.life / p.maxLife;
      this.positions[i * 3] = p.x;
      this.positions[i * 3 + 1] = p.y;
      this.positions[i * 3 + 2] = p.z;
      this.colors[i * 3] = p.color.r;
      this.colors[i * 3 + 1] = p.color.g;
      this.colors[i * 3 + 2] = p.color.b;
      this.sizes[i] = p.size * (p.shape ? 1 : 1 - t * 0.6);
      this.alphas[i] = t < 0.1 ? t / 0.1 : 1 - ((t - 0.1) / 0.9) ** 2;
      this.shapes[i] = p.shape;
      this.spins[i] = p.spin;
    }
    for (const name of [
      "position",
      "aColor",
      "aSize",
      "aAlpha",
      "aShape",
      "aSpin",
    ]) {
      this.geometry.getAttribute(name).needsUpdate = true;
    }
    this.geometry.setDrawRange(0, w);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
