import {
  type BufferGeometry,
  type CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";
import { Spring } from "./spring.ts";

export type Pulse = "none" | "selected" | "hint" | "conflict" | "same";

const TAU = Math.PI * 2;

/**
 * One cell of the 3D board: a rounded tile carrying its value glyph and
 * its pencil-note texture. Everything that moves is a spring, so state
 * changes only ever set targets and effects only ever add impulses.
 */
export class Tile {
  readonly index: number;
  readonly group = new Group();
  readonly body: Mesh;
  readonly material: MeshStandardMaterial;
  readonly value: Mesh;
  readonly valueMaterial: MeshBasicMaterial;
  readonly notes: Mesh;
  readonly notesMaterial: MeshBasicMaterial;
  /** Contact shadow on the box plate; darkens and drifts as the tile lifts. */
  readonly shadow: Mesh;
  private readonly shadowMaterial: MeshBasicMaterial;
  private depth = 1;
  shadowStrength = 0.4;

  shownDigit: number | null = null;
  shownKey = "";
  notesKey = "";

  readonly lift = new Spring(0, 260, 22);
  readonly scale = new Spring(1, 220, 16);
  readonly rotX = new Spring(0, 120, 14);
  readonly rotY = new Spring(0, 90, 12);
  readonly pop = new Spring(0, 320, 16);
  readonly spin = new Spring(0, 160, 14);
  readonly notesPop = new Spring(1, 300, 18);
  readonly glow = new Spring(0, 30, 11);
  readonly fade = new Spring(1, 200, 24);
  readonly grow = new Spring(1, 260, 18);

  shake = 0;
  pulse: Pulse = "none";
  readonly color = new Color();
  readonly targetColor = new Color();
  readonly pulseColor = new Color();
  readonly flashColor = new Color();
  private readonly phase = Math.random() * TAU;

  constructor(
    index: number,
    bodyGeometry: BufferGeometry,
    glyphGeometry: BufferGeometry,
    notesTexture: CanvasTexture,
    shadowTexture: CanvasTexture,
  ) {
    this.index = index;
    this.material = new MeshStandardMaterial({
      roughness: 0.88,
      metalness: 0,
    });
    this.body = new Mesh(bodyGeometry, this.material);
    this.valueMaterial = new MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.value = new Mesh(glyphGeometry, this.valueMaterial);
    this.value.visible = false;
    this.value.renderOrder = 2;
    this.notesMaterial = new MeshBasicMaterial({
      map: notesTexture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.notes = new Mesh(glyphGeometry, this.notesMaterial);
    this.notes.visible = false;
    this.notes.renderOrder = 1;
    this.group.add(this.body, this.value, this.notes);
    this.shadowMaterial = new MeshBasicMaterial({
      map: shadowTexture,
      color: 0x000000,
      transparent: true,
      depthWrite: false,
    });
    this.shadow = new Mesh(glyphGeometry, this.shadowMaterial);
  }

  get notesTexture(): CanvasTexture {
    return this.notesMaterial.map as CanvasTexture;
  }

  setGeometry(body: BufferGeometry, glyph: BufferGeometry, depth: number) {
    this.body.geometry = body;
    this.value.geometry = glyph;
    this.notes.geometry = glyph;
    this.shadow.geometry = glyph;
    this.depth = depth;
    this.body.position.z = -depth / 2;
    this.value.position.z = 0.8;
    this.notes.position.z = 0.6;
  }

  /** Spins the tile a full turn about Y; used by the victory wave. */
  flip() {
    this.rotY.target += TAU;
  }

  snapAll() {
    for (const s of this.springs()) s.snap(s.target);
    this.color.copy(this.targetColor);
    this.shake = 0;
  }

  private springs(): Spring[] {
    return [
      this.lift,
      this.scale,
      this.rotX,
      this.rotY,
      this.pop,
      this.spin,
      this.notesPop,
      this.glow,
      this.fade,
      this.grow,
    ];
  }

  /** Advances the tile; returns true while it is still moving. */
  step(dt: number, time: number, shakeAmp: number): boolean {
    let busy = false;
    for (const s of this.springs()) {
      if (!s.settled) {
        s.step(dt);
        busy = true;
      }
    }
    // A finished full turn is folded back to zero so flips never pile
    // up rotation the next spring would have to unwind.
    if (this.rotY.settled && this.rotY.target !== 0) {
      this.rotY.snap(this.rotY.target % TAU);
    }

    let dx = 0;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      dx = Math.sin(this.shake * 70) * shakeAmp * (this.shake / 0.45);
      busy = true;
    }

    this.group.position.z = this.lift.value;
    this.group.rotation.x = this.rotX.value;
    this.group.rotation.y = this.rotY.value;
    this.body.position.x = dx;
    this.value.position.x = dx;
    this.notes.position.x = dx;
    this.body.scale.setScalar(Math.max(this.scale.value, 0.001));
    this.group.scale.setScalar(this.grow.value);
    // The shadow falls down-right, away from the key light, and spreads
    // and darkens as the tile rises off the plate.
    const rise = Math.max(0, this.lift.value) / this.depth;
    this.shadow.position.set(
      this.group.position.x + rise * this.depth * 0.35,
      this.group.position.y - rise * this.depth * 0.55,
      -this.depth * 0.5,
    );
    this.shadow.scale.setScalar(1.05 + rise * 0.3);
    this.shadowMaterial.opacity =
      Math.min(1, rise) * this.shadowStrength * this.scale.value;
    this.shadow.visible = this.shadowMaterial.opacity > 0.005;

    const pop = Math.max(this.pop.value, 0) * Math.max(this.scale.value, 0);
    this.value.scale.setScalar(Math.max(pop, 0.001));
    this.value.rotation.y = this.spin.value;
    if (this.pop.target === 0 && this.pop.value < 0.03) {
      this.shownDigit = null;
      this.shownKey = "";
    }
    this.value.visible = this.shownDigit !== null && pop > 0.01;
    this.valueMaterial.opacity = Math.min(1, this.fade.value);
    this.notes.scale.setScalar(
      Math.max(this.notesPop.value * this.scale.value, 0.001),
    );

    const k = 1 - Math.exp(-dt * 16);
    if (!this.color.equals(this.targetColor)) {
      this.color.lerp(this.targetColor, k);
      if (
        Math.abs(this.color.r - this.targetColor.r) +
          Math.abs(this.color.g - this.targetColor.g) +
          Math.abs(this.color.b - this.targetColor.b) <
        0.002
      ) {
        this.color.copy(this.targetColor);
      }
      busy = true;
    }
    this.material.color.copy(this.color);

    const pulse = this.pulseStrength(time);
    const flash = Math.max(this.glow.value, 0);
    this.material.emissive.setRGB(
      this.pulseColor.r * pulse + this.flashColor.r * flash,
      this.pulseColor.g * pulse + this.flashColor.g * flash,
      this.pulseColor.b * pulse + this.flashColor.b * flash,
    );
    return busy;
  }

  private pulseStrength(time: number): number {
    const t = time + this.phase * 0.05;
    switch (this.pulse) {
      case "selected":
        return 0.1 + 0.07 * Math.sin(t * 3.4);
      case "conflict":
        return 0.16 + 0.12 * Math.sin(t * 6.5);
      case "hint":
        return 0.12 + 0.1 * Math.sin(t * 2.6);
      case "same":
        return 0.05 + 0.04 * Math.sin(t * 2.2 + this.index * 0.35);
      default:
        return 0;
    }
  }

  dispose() {
    this.material.dispose();
    this.valueMaterial.dispose();
    this.notesMaterial.dispose();
    this.notesTexture.dispose();
    this.shadowMaterial.dispose();
  }
}
