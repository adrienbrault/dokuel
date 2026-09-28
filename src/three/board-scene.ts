import { type Color, Group, PerspectiveCamera, Scene, Timer } from "three";
import { type CellHit, registerCellHitResolver } from "../lib/pointer-cell.ts";
import { createCelebration } from "./celebration.ts";
import { createCellKit } from "./cell-objects.ts";
import { approach } from "./easing.ts";
import { createMotes, createRingPool, createSparkPool } from "./effects.ts";
import { FOV, fitCamera, resolveCellHit, toNdc } from "./framing.ts";
import { buildGlyphAtlas, type GlyphAtlas } from "./glyph-atlas.ts";
import { BOARD_SPAN, cellPosition } from "./layout.ts";
import type { BoardPalette } from "./palette.ts";
import { createPipeline } from "./pipeline.ts";
import type { SceneSnapshot } from "./scene-state.ts";
import { createDotTexture } from "./shaders.ts";
import { createStage } from "./stage.ts";

/** A fraction of a degree of parallax, kept small enough that hit testing stays exact. */
const SWAY = 0.012;
/** Rate at which tiles chase their target height. */
const POSE_RATE = 14;

export type BoardScene = {
  /** Pushes the derived visual state of every cell into the scene. */
  setSnapshot(next: SceneSnapshot): void;
  /** Re-reads the design tokens, after a theme switch. */
  setPalette(next: BoardPalette): void;
  /** Rebuilds the glyph atlas, after a digit-mode or emoji-theme change. */
  setGlyphs(symbols: string[], mono: boolean): void;
  /** Feeds the pointer position, in client coordinates, or null when it leaves. */
  setPointer(x: number | null, y: number | null): void;
  /** Resolves a client coordinate to the cell under it. */
  hitTest(clientX: number, clientY: number): CellHit | null;
  /** Reframes after the board's CSS box changes size. */
  resize(boardPx: number): void;
  /** Turns drift, particles and shake off without rebuilding the scene. */
  setReducedMotion(reduced: boolean): void;
  /** Rings a cell, as when it is selected or a hint lands. */
  pulseCell(row: number, col: number, bright: boolean): void;
  /** Throws sparks from a cell. */
  sparkCell(row: number, col: number, colour: Color): void;
  /** Plays the completion moment. */
  celebrate(): void;
  dispose(): void;
};

/**
 * Builds the WebGL board: a slab, eighty-one tiles, and the digits as
 * real geometry, lit and post-processed.
 *
 * Returns null where WebGL or a 2D canvas is unavailable, so the caller
 * keeps the DOM board it already has instead of showing a blank
 * rectangle. Everything it creates is released by dispose(), because a
 * page that mounts and unmounts boards must not leak contexts.
 */
export function createBoardScene(
  canvas: HTMLCanvasElement,
  initialPalette: BoardPalette,
  symbols: string[],
  options: { mono: boolean; boardPx: number; reducedMotion: boolean },
): BoardScene | null {
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  const ready = createPipeline(canvas, scene, camera);
  if (!ready) return null;
  // A local name the frame loop can see as non-null.
  const pipeline = ready;
  const { renderer } = pipeline;

  let palette = initialPalette;
  const state = {
    mono: options.mono,
    reducedMotion: options.reducedMotion,
    boardPx: Math.max(1, options.boardPx),
  };
  const timer = new Timer();
  const stage = createStage(scene, palette);
  let viewDistance = 10;
  let elapsed = 0;

  const board = new Group();
  scene.add(board);
  // The slab rides the board group so the grid sways as one object
  // during the completion moment; the page stays behind it in the scene.
  board.add(stage.slab);

  const dotTexture = createDotTexture();
  let atlas: GlyphAtlas | null = buildGlyphAtlas(symbols, {
    mono: state.mono,
    anisotropy: renderer.capabilities.getMaxAnisotropy(),
  });
  if (!atlas) {
    stage.dispose();
    dotTexture.dispose();
    pipeline.dispose();
    return null;
  }

  const kit = createCellKit(board, palette, atlas);
  const rings = createRingPool(board, palette.accent);
  const sparks = createSparkPool(board, palette.accentBright, dotTexture);
  const motes = createMotes(
    scene,
    palette.accentBright,
    dotTexture,
    BOARD_SPAN / 2,
  );
  const moment = createCelebration({
    bloom: pipeline.bloom,
    flare: stage.flare,
    board,
    camera,
  });

  let snapshot: SceneSnapshot | null = null;
  const pointer = { x: 0, y: 0, present: false };
  let painted = false;

  function setSnapshot(next: SceneSnapshot) {
    snapshot = next;
    kit.apply(next.cells, {
      palette,
      digitMode: next.digitMode,
      elapsed,
      onPlace: (row, col, colour) => sparkCell(row, col, colour),
    });
    // The loop only paints on an animation tick, so a board handed its
    // first state would sit blank until one arrives - which never
    // happens while the tab is hidden or the frame clock is stalled. The
    // state that arrives first paints the frame it describes.
    if (!painted) {
      painted = true;
      frame();
    }
  }

  function pulseCell(row: number, col: number, bright: boolean) {
    if (state.reducedMotion) return;
    const [x, y] = cellPosition(row, col);
    rings.spawn(
      x,
      y,
      bright ? palette.accentBright : palette.accent,
      bright ? 0.9 : 0.55,
    );
  }

  function sparkCell(row: number, col: number, colour: Color) {
    if (state.reducedMotion) return;
    const [x, y] = cellPosition(row, col);
    sparks.spawn(x, y, colour);
  }

  function celebrate() {
    if (state.reducedMotion) return;
    moment.start();
  }

  /**
   * Switches motion without tearing the scene down. Preference changes
   * are rare and the board must not flicker when one lands, so a running
   * celebration is cut short back to its resting pose rather than left
   * to finish at a reduced frame rate.
   */
  function setReducedMotion(next: boolean) {
    if (state.reducedMotion === next) return;
    state.reducedMotion = next;
    if (next) moment.settle(viewDistance);
    if (snapshot) setSnapshot(snapshot);
  }

  function resize(boardPx: number) {
    state.boardPx = Math.max(1, boardPx);
    const width = canvas.clientWidth || state.boardPx;
    const height = canvas.clientHeight || state.boardPx;
    pipeline.resize(width, height);
    viewDistance = fitCamera(camera, width, height, state.boardPx);
    camera.position.z = viewDistance;
    stage.coverPage(camera.aspect, viewDistance);
  }

  let running = false;

  function frame() {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    elapsed += dt;
    const motion = !state.reducedMotion;

    if (snapshot) {
      kit.ease({
        dt,
        elapsed,
        motion,
        breathe: motion ? 0.5 + 0.5 * Math.sin(elapsed * Math.PI) : 0.5,
        celebrateLift: (index) => moment.lift(index),
      });
    }
    rings.update(dt);
    sparks.update(dt);
    motes.update(dt, elapsed, motion);
    stage.setTime(elapsed);
    pipeline.grain.uniforms.time!.value = elapsed % 100;

    if (moment.active) {
      moment.step(dt, viewDistance);
    } else if (motion) {
      // A fraction of a degree of parallax so the slab reads as solid.
      const sway = (pointer.present ? 1 : 0) * SWAY;
      const blend = approach(POSE_RATE, dt);
      camera.position.x += (pointer.x * sway - camera.position.x) * blend;
      camera.position.y += (-pointer.y * sway - camera.position.y) * blend;
      camera.lookAt(0, 0, 0);
    }

    pipeline.render();
  }

  function start() {
    if (running) return;
    running = true;
    timer.update();
    renderer.setAnimationLoop(frame);
  }

  function stop() {
    running = false;
    renderer.setAnimationLoop(null);
  }

  function resolveFromCanvas(clientX: number, clientY: number) {
    return resolveCellHit(
      camera,
      canvas.getBoundingClientRect(),
      clientX,
      clientY,
    );
  }

  resize(state.boardPx);
  start();
  const unregister = registerCellHitResolver(resolveFromCanvas);
  const observer =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => resize(state.boardPx));
  observer?.observe(canvas);
  const onVisibility = () => {
    if (document.visibilityState === "hidden") stop();
    else start();
  };
  document.addEventListener("visibilitychange", onVisibility);

  return {
    setSnapshot,
    setPalette(next) {
      palette = next;
      stage.setPalette(next);
      kit.setPalette(next);
      rings.recolour(next.accentBright);
      sparks.recolour(next.accentBright);
      motes.recolour(next.accentBright);
      if (snapshot) setSnapshot(snapshot);
    },
    setGlyphs(nextSymbols, mono) {
      const next = buildGlyphAtlas(nextSymbols, {
        mono,
        anisotropy: renderer.capabilities.getMaxAnisotropy(),
      });
      if (!next) return;
      atlas?.dispose();
      atlas = next;
      state.mono = mono;
      kit.setAtlas(next, mono);
      if (snapshot) setSnapshot(snapshot);
    },
    setPointer(x, y) {
      const ndc =
        x === null || y === null
          ? null
          : toNdc(canvas.getBoundingClientRect(), x, y);
      if (!ndc) {
        pointer.present = false;
        pointer.x = 0;
        pointer.y = 0;
        return;
      }
      pointer.present = true;
      pointer.x = ndc.x;
      pointer.y = ndc.y;
    },
    hitTest: resolveFromCanvas,
    resize,
    setReducedMotion,
    pulseCell,
    sparkCell,
    celebrate,
    dispose() {
      stop();
      unregister();
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      kit.dispose();
      rings.dispose();
      sparks.dispose();
      motes.dispose();
      stage.dispose();
      dotTexture.dispose();
      atlas?.dispose();
      pipeline.dispose();
    },
  };
}
