import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  type Color,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  Points,
  PointsMaterial,
  RingGeometry,
  type Texture,
} from "three";
import { clamp01, easeOutCubic } from "./easing.ts";
import { markGlow } from "./pipeline.ts";

function nearestFree<T extends { active: boolean }>(pool: T[]): T {
  for (const item of pool) if (!item.active) return item;
  return pool[0]!;
}

/**
 * Expanding rings that fly out of a cell when it is selected or when a
 * hint lands. Pooled because a burst that allocates a mesh per hit
 * stalls the frame the moment the player starts clicking quickly.
 */
export type RingPool = {
  spawn(x: number, y: number, colour: Color, opacity: number): void;
  update(dt: number): void;
  recolour(colour: Color): void;
  dispose(): void;
};

export function createRingPool(parent: Object3D, colour: Color): RingPool {
  const geometry = new RingGeometry(0.5, 0.56, 48);
  const rings: {
    mesh: Mesh;
    material: MeshStandardMaterial;
    life: number;
    active: boolean;
  }[] = [];
  for (let i = 0; i < 10; i++) {
    const material = new MeshStandardMaterial({
      color: colour.clone(),
      emissive: colour.clone(),
      emissiveIntensity: markGlow(colour),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new Mesh(geometry, material);
    mesh.visible = false;
    parent.add(mesh);
    rings.push({ mesh, material, life: 0, active: false });
  }

  return {
    spawn(x, y, next, opacity) {
      const ring = nearestFree(rings);
      ring.mesh.position.set(x, y, 0.2);
      ring.mesh.scale.setScalar(0.4);
      ring.material.color.copy(next);
      ring.material.emissive.copy(next);
      ring.material.emissiveIntensity = markGlow(next);
      ring.material.opacity = opacity;
      ring.mesh.visible = true;
      ring.life = 0;
      ring.active = true;
    },
    update(dt) {
      for (const ring of rings) {
        if (!ring.active) continue;
        ring.life += dt;
        const t = clamp01(ring.life / 0.6);
        ring.mesh.scale.setScalar(0.4 + easeOutCubic(t) * 1.2);
        ring.material.opacity *= 1 - t * t * 0.24;
        if (t >= 1) {
          ring.active = false;
          ring.mesh.visible = false;
        }
      }
    },
    recolour(next) {
      for (const ring of rings) {
        ring.material.color.copy(next);
        ring.material.emissive.copy(next);
        ring.material.emissiveIntensity = markGlow(next);
      }
    },
    dispose() {
      geometry.dispose();
      for (const ring of rings) ring.material.dispose();
    },
  };
}

const SPARK_COUNT = 26;

/**
 * Sparks thrown off a cell when a digit lands. They fly outward under
 * their own gravity, which is what makes a placement feel like an
 * impact rather than a repaint.
 */
export type SparkPool = {
  spawn(x: number, y: number, colour: Color): void;
  update(dt: number): void;
  recolour(colour: Color): void;
  dispose(): void;
};

export function createSparkPool(
  parent: Object3D,
  colour: Color,
  dot: Texture,
): SparkPool {
  const bursts: {
    points: Points;
    material: PointsMaterial;
    velocities: Float32Array;
    life: number;
    active: boolean;
  }[] = [];
  for (let i = 0; i < 6; i++) {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(SPARK_COUNT * 3, 3),
    );
    const material = new PointsMaterial({
      map: dot,
      color: colour.clone(),
      size: 0.13,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const points = new Points(geometry, material);
    points.visible = false;
    parent.add(points);
    bursts.push({
      points,
      material,
      velocities: new Float32Array(SPARK_COUNT * 3),
      life: 0,
      active: false,
    });
  }

  return {
    spawn(x, y, next) {
      const burst = nearestFree(bursts);
      const position = burst.points.geometry.getAttribute(
        "position",
      ) as BufferAttribute;
      const array = position.array as Float32Array;
      for (let i = 0; i < SPARK_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 1.6;
        array[i * 3] = x + Math.cos(angle) * 0.1;
        array[i * 3 + 1] = y + Math.sin(angle) * 0.1;
        array[i * 3 + 2] = 0.18;
        burst.velocities[i * 3] = Math.cos(angle) * speed;
        burst.velocities[i * 3 + 1] = Math.sin(angle) * speed;
        burst.velocities[i * 3 + 2] = 0.7 + Math.random() * 1.5;
      }
      position.needsUpdate = true;
      burst.material.color.copy(next);
      burst.material.opacity = 0.95;
      burst.points.visible = true;
      burst.life = 0;
      burst.active = true;
    },
    update(dt) {
      for (const burst of bursts) {
        if (!burst.active) continue;
        burst.life += dt;
        const t = clamp01(burst.life / 0.7);
        const position = burst.points.geometry.getAttribute(
          "position",
        ) as BufferAttribute;
        const array = position.array as Float32Array;
        for (let i = 0; i < SPARK_COUNT; i++) {
          array[i * 3] = array[i * 3]! + burst.velocities[i * 3]! * dt;
          array[i * 3 + 1] =
            array[i * 3 + 1]! + burst.velocities[i * 3 + 1]! * dt;
          array[i * 3 + 2] =
            array[i * 3 + 2]! + burst.velocities[i * 3 + 2]! * dt;
          burst.velocities[i * 3 + 2] = burst.velocities[i * 3 + 2]! - 3.2 * dt;
        }
        position.needsUpdate = true;
        burst.material.opacity = 0.95 * (1 - t) ** 2;
        if (t >= 1) {
          burst.active = false;
          burst.points.visible = false;
        }
      }
    },
    recolour(next) {
      for (const burst of bursts) burst.material.color.copy(next);
    },
    dispose() {
      for (const burst of bursts) {
        burst.points.geometry.dispose();
        burst.material.dispose();
      }
    },
  };
}

const MOTE_COUNT = 160;

/**
 * Motes drifting up through the light in front of the board. Nothing
 * about them is interactive; they exist to say the board occupies a
 * space, which is the one thing a flat grid can never convey.
 */
export type Motes = {
  update(dt: number, elapsed: number, motion: boolean): void;
  recolour(colour: Color): void;
  dispose(): void;
};

export function createMotes(
  parent: Object3D,
  colour: Color,
  dot: Texture,
  span: number,
): Motes {
  const positions = new Float32Array(MOTE_COUNT * 3);
  const speeds = new Float32Array(MOTE_COUNT);
  for (let i = 0; i < MOTE_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * span * 1.6;
    positions[i * 3 + 1] = (Math.random() - 0.5) * span * 2;
    positions[i * 3 + 2] = 0.5 + Math.random() * 2.6;
    speeds[i] = 0.08 + Math.random() * 0.3;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  const material = new PointsMaterial({
    map: dot,
    color: colour.clone(),
    size: 0.05,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  const points = new Points(geometry, material);
  parent.add(points);
  const limit = span;

  return {
    update(dt, elapsed, motion) {
      if (!motion) return;
      for (let i = 0; i < MOTE_COUNT; i++) {
        positions[i * 3 + 1] = positions[i * 3 + 1]! + speeds[i]! * dt;
        positions[i * 3] =
          positions[i * 3]! + Math.sin(elapsed * 0.5 + i) * 0.03 * dt;
        if (positions[i * 3 + 1]! > limit) positions[i * 3 + 1] = -limit;
      }
      geometry.getAttribute("position")!.needsUpdate = true;
    },
    recolour(next) {
      material.color.copy(next);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
