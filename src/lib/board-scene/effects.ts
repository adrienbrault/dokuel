import {
  BufferGeometry,
  CanvasTexture,
  type Color,
  Group,
  type Material,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Shape,
  ShapeGeometry,
} from "three";
import { Spring } from "./spring.ts";

function roundedRectShape(size: number, radius: number): Shape {
  const h = size / 2;
  const r = Math.min(radius, h);
  const s = new Shape();
  s.moveTo(-h + r, -h);
  s.lineTo(h - r, -h);
  s.quadraticCurveTo(h, -h, h, -h + r);
  s.lineTo(h, h - r);
  s.quadraticCurveTo(h, h, h - r, h);
  s.lineTo(-h + r, h);
  s.quadraticCurveTo(-h, h, -h, h - r);
  s.lineTo(-h, -h + r);
  s.quadraticCurveTo(-h, -h, -h + r, -h);
  return s;
}

/**
 * The selection cursor: a glowing frame that glides from cell to cell
 * instead of jumping, riding on top of the lifted selected tile.
 */
export class Cursor {
  readonly mesh: Mesh;
  private readonly material = new MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  readonly x = new Spring(0, 320, 28);
  readonly y = new Spring(0, 320, 28);
  readonly z = new Spring(0, 260, 22);
  readonly scale = new Spring(0, 260, 20);

  constructor() {
    this.mesh = new Mesh(new BufferGeometry(), this.material);
    this.mesh.renderOrder = 5;
  }

  setSize(cellPx: number) {
    const outer = roundedRectShape(cellPx + 5, cellPx * 0.2);
    const inner = roundedRectShape(cellPx - 1, cellPx * 0.14);
    outer.holes.push(inner);
    this.mesh.geometry.dispose();
    this.mesh.geometry = new ShapeGeometry(outer, 6);
  }

  setColor(color: Color) {
    this.material.color.copy(color);
  }

  step(dt: number, time: number): boolean {
    let busy = false;
    for (const s of [this.x, this.y, this.z, this.scale]) {
      if (!s.settled) {
        s.step(dt);
        busy = true;
      }
    }
    this.mesh.position.set(this.x.value, this.y.value, this.z.value + 1.2);
    const scale = Math.max(this.scale.value, 0.001);
    this.mesh.scale.setScalar(scale);
    this.mesh.visible = this.scale.value > 0.02;
    this.material.opacity =
      Math.min(1, scale) * (0.8 + 0.2 * Math.sin(time * 4));
    return busy;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

type Ripple = { mesh: Mesh; t: number; life: number; size: number };

/** Expanding rings that radiate from a freshly placed digit. */
export class Ripples {
  readonly group = new Group();
  private readonly geometry = new RingGeometry(0.86, 1, 48);
  private active: Ripple[] = [];
  private pool: Mesh[] = [];

  spawn(x: number, y: number, z: number, size: number, color: Color) {
    const mesh =
      this.pool.pop() ??
      new Mesh(
        this.geometry,
        new MeshBasicMaterial({
          transparent: true,
          depthWrite: false,
          depthTest: false,
          toneMapped: false,
        }),
      );
    (mesh.material as MeshBasicMaterial).color.copy(color);
    mesh.position.set(x, y, z);
    mesh.renderOrder = 6;
    this.group.add(mesh);
    this.active.push({ mesh, t: 0, life: 0.55, size });
  }

  get alive(): boolean {
    return this.active.length > 0;
  }

  step(dt: number) {
    this.active = this.active.filter((r) => {
      r.t += dt;
      const k = r.t / r.life;
      if (k >= 1) {
        this.group.remove(r.mesh);
        this.pool.push(r.mesh);
        return false;
      }
      const ease = 1 - (1 - k) ** 3;
      r.mesh.scale.setScalar(r.size * (0.35 + ease * 0.9));
      (r.mesh.material as MeshBasicMaterial).opacity = 0.75 * (1 - k);
      return true;
    });
  }

  dispose() {
    this.geometry.dispose();
    for (const m of [...this.pool, ...this.active.map((r) => r.mesh)]) {
      (m.material as Material).dispose();
    }
  }
}

/** A soft radial blob used as the board's contact shadow. */
export function shadowTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 20, 64, 64, 64);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new CanvasTexture(canvas);
}
