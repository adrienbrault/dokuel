import {
  BufferGeometry,
  type Color,
  Group,
  type Material,
  MathUtils,
  type Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  type WebGLRenderer,
} from "three";
import { boardSizePx, cellAtPx } from "../board-layout.ts";
import type { Stage } from "./choreography.ts";
import { Cursor, Ripples, shadowTexture } from "./effects.ts";
import { GlyphCache } from "./glyphs.ts";
import { Particles } from "./particles.ts";
import {
  createBoardParts,
  createRenderer,
  layoutBoard,
  paintTheme,
} from "./scene-layout.ts";
import { applyState, type BoardSceneState } from "./scene-state.ts";
import { Spring } from "./spring.ts";
import { readBoardTheme } from "./theme.ts";
import { Tile } from "./tile.ts";

export type { BoardSceneState };

/** Extra canvas around the board, so tilt, lift and sparks can spill. */
export const SCENE_MARGIN = 28;
const FOV = 16;
const MAX_TILT = 0.07;

/**
 * The WebGL board. It draws, and never decides: React hands it the
 * board and the per-cell visual state, it diffs that against the last
 * frame and animates the difference. Input stays on the DOM grid above.
 */
export class BoardScene {
  readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 1, 10000);
  private readonly root = new Group();
  private readonly base: Mesh;
  private readonly plates: Mesh[];
  private readonly shadow: Mesh;
  private readonly tiltX = new Spring(0, 60, 12);
  private readonly tiltY = new Spring(0, 60, 12);
  readonly glyphs: GlyphCache;
  private readonly observer: MutationObserver;
  readonly stage: Stage;
  readonly cursor = new Cursor();
  prev: BoardSceneState | null = null;
  private timeline: { at: number; run: () => void }[] = [];
  private time = 0;
  private raf = 0;
  private lastTick = 0;
  private lastRender = 0;
  private disposed = false;
  private readonly onFirstFrame: () => void;

  constructor(
    canvas: HTMLCanvasElement,
    reducedMotion: boolean,
    onFirstFrame: () => void,
  ) {
    this.onFirstFrame = onFirstFrame;
    this.renderer = createRenderer(canvas, this.scene);
    this.scene.add(this.root);

    const theme = readBoardTheme();
    this.glyphs = new GlyphCache(theme);
    const particles = new Particles(
      this.renderer.getPixelRatio(),
      theme.isDark,
    );
    const ripples = new Ripples();
    const parts = createBoardParts();
    this.base = parts.base;
    this.plates = parts.plates;
    this.shadow = parts.shadow;
    this.root.add(...this.plates);
    this.scene.add(this.shadow);
    this.root.add(this.base, this.cursor.mesh, ripples.group);
    this.scene.add(particles.points);

    const glyphGeometry = new PlaneGeometry(1, 1);
    const tileShadow = shadowTexture();
    const tiles = Array.from(
      { length: 81 },
      (_, i) =>
        new Tile(
          i,
          new BufferGeometry(),
          glyphGeometry,
          this.glyphs.createNotesTexture(),
          tileShadow,
        ),
    );
    for (const t of tiles) this.root.add(t.shadow, t.group);

    this.stage = {
      tiles,
      particles,
      ripples,
      theme,
      cellPx: 0,
      depth: 0,
      boardPx: 0,
      reducedMotion,
      after: (seconds, run) =>
        this.timeline.push({ at: this.time + seconds, run }),
      inkColor: (i) => this.inkColor(i),
    };
    this.applyTheme();

    this.observer = new MutationObserver(() => this.refreshTheme());
    this.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-digit-color", "style"],
    });
    // Glyphs drawn before the web font arrives use a fallback face.
    document.fonts?.ready.then(() => this.refreshTheme());
  }

  /** The color a cell's digit is drawn in, for effects to echo. */
  inkColor(index: number): Color {
    if (this.stage.theme.digitMode === "emoji") return this.stage.theme.accent;
    return this.stage.tiles[index]!.valueMaterial.color;
  }

  setLayout(cellPx: number) {
    if (cellPx === this.stage.cellPx) return;
    const s = this.stage;
    s.cellPx = cellPx;
    s.depth = Math.max(3, Math.round(cellPx * 0.12));
    s.boardPx = boardSizePx(cellPx);
    const canvasPx = s.boardPx + SCENE_MARGIN * 2;
    this.renderer.setSize(canvasPx, canvasPx, false);
    const distance = canvasPx / 2 / Math.tan(MathUtils.degToRad(FOV / 2));
    this.camera.position.set(0, 0, distance);
    this.camera.near = distance * 0.5;
    this.camera.far = distance * 2;
    this.camera.updateProjectionMatrix();

    layoutBoard(
      {
        tiles: s.tiles,
        plates: this.plates,
        base: this.base,
        shadow: this.shadow,
      },
      cellPx,
      s.depth,
    );
    this.cursor.setSize(cellPx);
    this.requestFrame();
  }

  private refreshTheme() {
    if (this.disposed) return;
    this.stage.theme = readBoardTheme();
    this.glyphs.setTheme(this.stage.theme);
    this.applyTheme();
    for (const t of this.stage.tiles) {
      t.shownKey = "";
      t.notesKey = "";
    }
    if (this.prev) this.update(this.prev, false);
  }

  private applyTheme() {
    const { theme, tiles, particles } = this.stage;
    paintTheme(
      { tiles, plates: this.plates, base: this.base, shadow: this.shadow },
      theme,
    );
    this.cursor.setColor(theme.accent);
    // Reflections lift every surface by a constant amount, which is
    // gloss on a pale tile but grey haze on a near-black one.
    this.scene.environmentIntensity = theme.isDark ? 0.03 : 0.12;
    particles.setBlending(theme.isDark);
  }

  update(state: BoardSceneState, animate = true) {
    applyState(this, state, animate);
    this.prev = state;
    this.requestFrame();
  }

  /** Pointer in board-local CSS pixels, or null once it leaves. */
  setPointer(x: number | null, y = 0) {
    const s = this.stage;
    if (x === null || s.boardPx === 0) {
      this.tiltX.target = 0;
      this.tiltY.target = 0;
      this.hover(null);
    } else {
      if (!s.reducedMotion) {
        this.tiltY.target = (x / s.boardPx - 0.5) * 2 * MAX_TILT;
        this.tiltX.target = (y / s.boardPx - 0.5) * 2 * MAX_TILT;
      }
      const cell = cellAtPx(x, y, s.cellPx);
      this.hover(cell ? cell.row * 9 + cell.col : null);
    }
    this.requestFrame();
  }

  hovered: number | null = null;
  private hover(index: number | null) {
    if (index === this.hovered) return;
    this.hovered = index;
    if (this.prev) applyState(this, this.prev, false);
  }

  press(x: number, y: number) {
    const cell = cellAtPx(x, y, this.stage.cellPx);
    if (!cell || this.stage.reducedMotion) return;
    this.stage.tiles[cell.row * 9 + cell.col]!.lift.kick(
      -this.stage.depth * 20,
    );
    this.requestFrame();
  }

  requestFrame() {
    if (!this.raf && !this.disposed)
      this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.raf = 0;
    const dt = this.lastTick
      ? Math.min((now - this.lastTick) / 1000, 0.05)
      : 1 / 60;
    this.lastTick = now;
    this.time += dt;
    const s = this.stage;

    const due = this.timeline.filter((e) => e.at <= this.time);
    if (due.length > 0) {
      this.timeline = this.timeline.filter((e) => e.at > this.time);
      for (const e of due) e.run();
    }

    let busy = this.timeline.length > 0;
    for (const spring of [this.tiltX, this.tiltY]) {
      if (!spring.settled) {
        spring.step(dt);
        busy = true;
      }
    }
    this.root.rotation.x = this.tiltX.value;
    this.root.rotation.y = this.tiltY.value;
    let pulsing = false;
    for (const tile of s.tiles) {
      if (tile.step(dt, this.time, s.cellPx * 0.08)) busy = true;
      if (tile.pulse !== "none") pulsing = true;
    }
    if (this.cursor.step(dt, this.time)) busy = true;
    if (this.cursor.mesh.visible) pulsing = true;
    s.ripples.step(dt);
    s.particles.update(dt);
    if (s.ripples.alive || s.particles.alive) busy = true;

    // Idle pulsing (selection glow, conflicts) renders at ~30fps to
    // spare the battery; real motion gets every frame.
    if (busy || now - this.lastRender > 32) {
      this.renderer.render(this.scene, this.camera);
      if (this.lastRender === 0) this.onFirstFrame();
      this.lastRender = now;
    }
    if (busy || pulsing) this.requestFrame();
    else this.lastTick = 0;
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    for (const t of this.stage.tiles) t.dispose();
    const first = this.stage.tiles[0];
    for (const g of [first?.body.geometry, first?.value.geometry]) g?.dispose();
    for (const p of [...this.plates, this.base, this.shadow]) {
      p.geometry.dispose();
      (p.material as Material).dispose();
    }
    this.cursor.dispose();
    this.stage.ripples.dispose();
    this.stage.particles.dispose();
    this.glyphs.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // browsers cap live contexts
  }
}
