import { ACESFilmicToneMapping, PerspectiveCamera, WebGLRenderer } from "three";
import type {
  AmbianceEvent,
  AmbianceScene,
  AmbianceState,
} from "../lib/ambiance.ts";
import {
  type AmbianceQuality,
  createFrameMonitor,
  degradeQuality,
} from "../lib/ambiance-quality.ts";
import { createChoreography } from "./choreography.ts";
import { damp } from "./damp.ts";
import { DARK_PALETTE, LIGHT_PALETTE } from "./palette.ts";
import { createPost } from "./post.ts";
import { createRig } from "./rig.ts";
import { createWorld, type WorldMood } from "./world.ts";

export type AmbianceEngineOptions = {
  quality: AmbianceQuality;
  dark: boolean;
  reducedMotion: boolean;
  /**
   * Skip the intro and never trade quality away: automated browsers
   * (screenshots) render in software at a few fps and would otherwise
   * capture a slow-motion intro at degraded resolution.
   */
  settled: boolean;
  getState: () => AmbianceState;
  /** The GPU dropped the context; the caller should fall back to CSS. */
  onContextLost: () => void;
};

export type AmbianceEngine = {
  handle: (event: AmbianceEvent) => void;
  setDark: (dark: boolean) => void;
  dispose: () => void;
};

/** Per-scene targets the moods ease toward. */
const MOODS: Record<AmbianceScene, Omit<WorldMood, "progress">> = {
  menu: { energy: 1, shaft: 1, spread: 1 },
  // Calmer and wider while a board is up: the world frames the puzzle
  // instead of competing with it.
  game: { energy: 0.55, shaft: 0.18, spread: 1.3 },
};

export async function createAmbianceEngine(
  canvas: HTMLCanvasElement,
  options: AmbianceEngineOptions,
): Promise<AmbianceEngine> {
  let quality = options.quality;
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
    stencil: false,
  });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.setPixelRatio(quality.pixelRatio);

  const camera = new PerspectiveCamera(45, 1, 0.1, 1200);
  const rig = createRig(camera);
  const world = await createWorld(
    renderer,
    quality,
    options.dark ? DARK_PALETTE : LIGHT_PALETTE,
  );
  const choreography = createChoreography(world.floor, world.tiles);
  const post = createPost(renderer, world.scene, camera, {
    msaa: quality.msaa,
    bloom: quality.bloom,
    palette: world.palette,
  });

  const mood: WorldMood = { ...MOODS.menu, progress: 0 };
  let time = 0;
  let appear = options.settled ? 1 : 0;
  let dirty = true;

  function resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(quality.pixelRatio);
    renderer.setSize(width, height, false);
    post.setSize(width, height, quality.pixelRatio);
    rig.setViewport(width, height);
    dirty = true;
  }

  function step(dt: number) {
    const state = options.getState();
    const target = MOODS[state.scene];
    const surge = choreography.step(time, dt);
    mood.energy = damp(
      mood.energy,
      target.energy + state.progress * 0.3 + surge * 0.9,
      1.5,
      dt,
    );
    mood.shaft = damp(mood.shaft, target.shaft + surge * 0.8, 1.2, dt);
    mood.spread = damp(mood.spread, target.spread, 0.9, dt);
    mood.progress = damp(mood.progress, state.progress, 2, dt);
    appear = Math.min(1, appear + dt * 0.45);
    // The intro glides in slower than later scene changes.
    rig.update(state.scene, time, dt, appear < 1 ? 1.1 : 1.8);
    world.update(
      time,
      dt,
      mood,
      surge,
      appear,
      rig.position,
      quality.pixelRatio,
    );
  }

  function render() {
    post.render(
      time,
      choreography.bloomBoost + (mood.energy - 1) * 0.25,
      choreography.flash,
      choreography.flashAmount,
    );
    dirty = false;
  }

  const monitor = createFrameMonitor();
  let raf = 0;
  let lastFrame = performance.now();
  let lastRender = 0;

  function loop(now: number) {
    raf = requestAnimationFrame(loop);
    if (document.hidden) {
      lastFrame = now;
      return;
    }
    const fps = options.getState().scene === "game" ? quality.gameFps : 60;
    const interval = now - lastRender;
    if (fps < 60 && interval < 1000 / fps - 2) return;
    lastRender = now;
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    time += dt;
    step(dt);
    render();

    // Normalize to a 60fps budget so a paced 30fps is not "slow".
    if (!options.settled && monitor.sample(interval * (fps / 60))) {
      const next = degradeQuality(quality);
      if (next) {
        quality = next;
        post.setBloom(quality.bloom);
        resize();
      }
    }
  }

  // Reduced motion: no loop. Settle instantly on each scene and theme
  // change and paint a single still frame.
  let stillScene: AmbianceScene | null = null;
  let stillTimer = 0;
  function paintStill() {
    const { scene } = options.getState();
    if (scene === stillScene && !dirty) return;
    stillScene = scene;
    appear = 1;
    time = 12;
    for (let i = 0; i < 40; i++) step(0.25);
    rig.snap(scene, time);
    render();
  }

  function onPointerMove(e: PointerEvent) {
    rig.onPointerMove(e);
  }

  function onContextLost(e: Event) {
    e.preventDefault();
    cancelAnimationFrame(raf);
    options.onContextLost();
  }

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  canvas.addEventListener("webglcontextlost", onContextLost);

  step(0);
  if (options.settled) rig.snap(options.getState().scene, time);
  // Link every program before the first frame, off the main thread where
  // the browser supports parallel shader compilation. A synchronous
  // compile stalls the page right as the player makes their first tap.
  await renderer.compileAsync(world.scene, camera);

  if (options.reducedMotion) {
    paintStill();
    stillTimer = window.setInterval(paintStill, 400);
  } else {
    raf = requestAnimationFrame(loop);
  }

  return {
    handle(event) {
      if (options.reducedMotion) return;
      choreography.handle(event, world.palette, time);
    },
    setDark(dark) {
      const next = dark ? DARK_PALETTE : LIGHT_PALETTE;
      if (next === world.palette) return;
      world.setPalette(next);
      post.setPalette(next);
      dirty = true;
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.clearInterval(stillTimer);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      world.dispose();
      post.dispose();
      renderer.dispose();
      // Hand the GPU context back now rather than at garbage collection:
      // browsers cap live contexts, and a re-enable makes a new one.
      renderer.forceContextLoss();
    },
  };
}
