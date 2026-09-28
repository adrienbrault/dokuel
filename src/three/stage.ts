import {
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  type Scene,
  ShaderMaterial,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { BOARD_SPAN } from "./layout.ts";
import type { BoardPalette } from "./palette.ts";
import { BACKDROP_SHADER } from "./shaders.ts";

/** Half-angle of the board's field of view, for the backdrop's coverage. */
const HALF_FOV_RAD = (15 * Math.PI) / 180;

export type Stage = {
  /** The page the board stands on, painted to match the app's own background. */
  page: Mesh;
  slab: Mesh;
  flare: PointLight;
  /** Stretches the backdrop until it covers the frame at the board's distance. */
  coverPage(aspect: number, distance: number): void;
  setTime(elapsed: number): void;
  setPalette(palette: BoardPalette): void;
  dispose(): void;
};

/**
 * The light and the surface the board sits in.
 *
 * The canvas is opaque rather than transparent, so the backdrop has to
 * reproduce the page's own colour: bloom composited over a transparent
 * buffer smears the alpha where it meets the DOM, and the halo it leaves
 * around a glowing tile is impossible to hide.
 */
export function createStage(scene: Scene, palette: BoardPalette): Stage {
  const hemi = new HemisphereLight(palette.page, palette.slab, 1.1);
  scene.add(hemi);

  // The key light is what lets a digit throw a shadow across its own
  // tile, which is most of what separates a raised mark from a decal.
  const key = new DirectionalLight(0xffffff, 1.7);
  key.position.set(3.4, 5.2, 7.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -7;
  key.shadow.camera.right = 7;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -7;
  key.shadow.bias = -0.0008;
  key.shadow.radius = 3;
  scene.add(key);

  // A rim of accent light from below separates the slab from the page.
  const rim = new DirectionalLight(palette.accent, 0.6);
  rim.position.set(-5, -3.5, 4);
  scene.add(rim);

  // The completion flare is blown out through the bloom pass, so it is
  // dark until the board is finished.
  const flare = new PointLight(palette.accentBright, 0, 16, 2);
  flare.position.set(0, 0, 3.2);
  scene.add(flare);

  const pageGeometry = new PlaneGeometry(1, 1);
  const pageUniforms = {
    centre: { value: palette.page.clone().lerp(new Color(1, 1, 1), 0.22) },
    edge: { value: palette.page.clone().lerp(new Color(0, 0, 0), 0.2) },
    accent: { value: palette.accent.clone() },
    time: { value: 0 },
  };
  const pageMaterial = new ShaderMaterial({
    uniforms: pageUniforms,
    vertexShader: BACKDROP_SHADER.vertexShader,
    fragmentShader: BACKDROP_SHADER.fragmentShader,
    depthWrite: false,
  });
  const page = new Mesh(pageGeometry, pageMaterial);
  page.position.z = -3;
  page.renderOrder = -1;
  scene.add(page);

  const slabGeometry = new RoundedBoxGeometry(
    BOARD_SPAN + 0.42,
    BOARD_SPAN + 0.42,
    0.5,
    4,
    0.22,
  );
  const slabMaterial = new MeshStandardMaterial({
    color: palette.slab,
    roughness: 0.5,
    metalness: 0.08,
  });
  const slab = new Mesh(slabGeometry, slabMaterial);
  slab.position.z = -0.25;
  slab.receiveShadow = true;
  scene.add(slab);

  return {
    page,
    slab,
    flare,
    coverPage(aspect, distance) {
      // The backdrop sits three units behind the board, so it has to be
      // scaled for the frame it occupies at that depth, with margin for
      // the camera's sway.
      const cover = 2 * Math.tan(HALF_FOV_RAD) * (distance + 3);
      page.scale.set(cover * aspect * 1.3, cover * 1.3, 1);
    },
    setTime(elapsed) {
      pageUniforms.time.value = elapsed;
    },
    setPalette(next) {
      hemi.color.copy(next.page);
      hemi.groundColor.copy(next.slab);
      rim.color.copy(next.accent);
      flare.color.copy(next.accentBright);
      slabMaterial.color.copy(next.slab);
      pageUniforms.centre.value.copy(
        next.page.clone().lerp(new Color(1, 1, 1), 0.22),
      );
      pageUniforms.edge.value.copy(
        next.page.clone().lerp(new Color(0, 0, 0), 0.2),
      );
      pageUniforms.accent.value.copy(next.accent);
    },
    dispose() {
      hemi.dispose();
      key.dispose();
      rim.dispose();
      flare.dispose();
      pageGeometry.dispose();
      pageMaterial.dispose();
      slabGeometry.dispose();
      slabMaterial.dispose();
    },
  };
}
