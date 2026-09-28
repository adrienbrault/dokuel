import {
  ACESFilmicToneMapping,
  type Color,
  PCFShadowMap,
  type PerspectiveCamera,
  type Scene,
  Vector2,
  WebGLRenderer,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { GRAIN_SHADER } from "./shaders.ts";

/** Bloom at rest; the completion moment pushes it past blowout. */
export const BLOOM_STRENGTH = 0.32;
/** Bloom starts well above the tile's own brightness, so only a glow blooms. */
export const BLOOM_THRESHOLD = 0.82;
/** Radius and strength of the halo a glowing tile throws. */
const BLOOM_RADIUS = 0.7;

/**
 * The emissive intensity that puts a mark of this colour inside the bloom.
 *
 * Bloom reads the linear buffer before tone mapping, so a mark only glows
 * if its own luminance clears the threshold. The accent is a mid green and
 * a spark is near white, so one fixed intensity suits neither: the green
 * stays under the window and draws flat, the white saturates into a blob.
 * Scaling by the colour's luminance gives every mark the same headroom.
 */
export function markGlow(colour: Color): number {
  const luma = 0.2126 * colour.r + 0.7152 * colour.g + 0.0722 * colour.b;
  return (BLOOM_THRESHOLD * 1.4) / Math.max(luma, 0.05);
}

export type Pipeline = {
  renderer: WebGLRenderer;
  bloom: UnrealBloomPass;
  grain: ShaderPass;
  resize(width: number, height: number): void;
  render(): void;
  dispose(): void;
};

/**
 * The renderer and its post-processing chain.
 *
 * Returns null where WebGL is unavailable - a headless test run, a
 * GPU-less browser, an exhausted context pool - so the caller can keep
 * the DOM board instead of showing a blank rectangle.
 *
 * The grain pass sits after bloom and before OutputPass so it is tone
 * mapped with everything else: grain applied to the encoded output
 * shimmers at a different rate than the scene underneath it.
 */
export function createPipeline(
  canvas: HTMLCanvasElement,
  scene: Scene,
  camera: PerspectiveCamera,
): Pipeline | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch {
    // jsdom hands back a canvas that cannot produce a context at all.
    return null;
  }
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new Vector2(1, 1),
    BLOOM_STRENGTH,
    BLOOM_RADIUS,
    BLOOM_THRESHOLD,
  );
  composer.addPass(bloom);
  const grain = new ShaderPass(GRAIN_SHADER);
  composer.addPass(grain);
  // OutputPass does the tone mapping and the sRGB encode, so every pass
  // before it works in linear light.
  composer.addPass(new OutputPass());

  return {
    renderer,
    bloom,
    grain,
    resize(width, height) {
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
    },
    render() {
      composer.render();
    },
    dispose() {
      composer.dispose();
      renderer.dispose();
    },
  };
}
