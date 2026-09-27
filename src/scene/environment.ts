import {
  type Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  type Texture,
  type WebGLRenderer,
} from "three";
import type { ScenePalette } from "./palette.ts";

/**
 * A reflection environment built from light panels rather than an HDR
 * file: a key overhead, teal fill to one side, a warm kicker to the
 * other. The tiles' clearcoat picks these up as colored highlights.
 */
export function buildEnvironment(
  renderer: WebGLRenderer,
  palette: ScenePalette,
): Texture {
  const envScene = new Scene();
  envScene.background = palette.env.background.clone();
  const panel = (color: Color, w: number, h: number) => {
    const mesh = new Mesh(
      new PlaneGeometry(w, h),
      new MeshBasicMaterial({ color, side: DoubleSide }),
    );
    envScene.add(mesh);
    return mesh;
  };
  const key = panel(palette.env.key, 6, 6);
  key.position.set(0, 8, 0);
  key.rotation.x = Math.PI / 2;
  const fill = panel(palette.env.fill, 3, 8);
  fill.position.set(-8, 2, 1);
  fill.rotation.y = Math.PI / 2;
  const warm = panel(palette.env.warm, 3, 6);
  warm.position.set(8, 1, -2);
  warm.rotation.y = -Math.PI / 2;
  const strip = panel(palette.env.fill, 12, 0.4);
  strip.position.set(0, 3, -8);

  const pmrem = new PMREMGenerator(renderer);
  const texture = pmrem.fromScene(envScene, 0.035).texture;
  pmrem.dispose();
  envScene.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose();
      (object.material as MeshBasicMaterial).dispose();
    }
  });
  return texture;
}
