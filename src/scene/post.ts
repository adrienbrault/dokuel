import {
  Color,
  HalfFloatType,
  type PerspectiveCamera,
  type Scene,
  Vector2,
  type WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import type { ScenePalette } from "./palette.ts";

/**
 * The film look, applied after tone mapping: faint chromatic fringing
 * toward the corners, a vignette, animated grain, and a full-frame
 * flash the game can fire (red on a conflict, gold on a win).
 */
const GradeShader = {
  name: "DokuelGrade",
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.5 },
    uGrain: { value: 0.04 },
    uAberration: { value: 0.006 },
    uFlash: { value: new Color() },
    uFlashAmount: { value: 0 },
    uResolution: { value: new Vector2(1, 1) },
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
    uniform float uVignette;
    uniform float uGrain;
    uniform float uAberration;
    uniform vec3 uFlash;
    uniform float uFlashAmount;
    uniform vec2 uResolution;
    varying vec2 vUv;
    void main() {
      vec2 dc = vUv - 0.5;
      vec2 shift = dc * uAberration * dot(dc, dc) * 4.0;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + shift).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - shift).b;
      // A flash that reads from the edges inward, like light spilling in.
      float edge = smoothstep(0.1, 0.75, length(dc));
      col += uFlash * uFlashAmount * (0.35 + 0.65 * edge);
      float v = smoothstep(0.95, 0.25, length(dc * vec2(1.0, 1.15)));
      col *= mix(1.0 - uVignette, 1.0, v);
      vec2 px = floor(vUv * uResolution);
      float n = fract(sin(dot(px + fract(uTime * 7.13) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createPost(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
  options: { msaa: number; bloom: boolean; palette: ScenePalette },
) {
  const target = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    samples: options.msaa,
  });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector2(1, 1), 1, 0.6, 0.6);
  bloom.enabled = options.bloom;
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  const g = grade.uniforms as typeof GradeShader.uniforms;
  let bloomBase = 1;
  function setPalette(p: ScenePalette) {
    bloomBase = p.bloomStrength;
    bloom.radius = p.bloomRadius;
    bloom.threshold = p.bloomThreshold;
    g.uVignette.value = p.vignette;
    g.uGrain.value = p.grain;
    g.uAberration.value = p.aberration;
  }
  setPalette(options.palette);

  return {
    setPalette,
    setBloom(enabled: boolean) {
      bloom.enabled = enabled;
    },
    setSize(width: number, height: number, pixelRatio: number) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
      g.uResolution.value.set(width * pixelRatio, height * pixelRatio);
    },
    render(time: number, boost: number, flash: Color, flashAmount: number) {
      bloom.strength = bloomBase * (1 + boost);
      g.uTime.value = time;
      g.uFlash.value.copy(flash);
      g.uFlashAmount.value = flashAmount;
      composer.render();
    },
    dispose() {
      composer.dispose();
      bloom.dispose();
      target.dispose();
    },
  };
}
