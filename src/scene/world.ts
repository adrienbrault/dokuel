import {
  DirectionalLight,
  HemisphereLight,
  PointLight,
  Scene,
  type Vector3,
  type WebGLRenderer,
} from "three";
import type { AmbianceQuality } from "../lib/ambiance-quality.ts";
import { createMotes, createShaft, createSky } from "./atmosphere.ts";
import { buildEnvironment } from "./environment.ts";
import { createFloor } from "./floor.ts";
import { createMonoliths } from "./monoliths.ts";
import type { ScenePalette } from "./palette.ts";
import { createTiles } from "./tiles.ts";

/** The continuous values the world is lit by, eased by the engine. */
export type WorldMood = {
  energy: number;
  shaft: number;
  spread: number;
  progress: number;
};

/**
 * Everything that exists in the place: sky, floor, dust, light shaft,
 * monoliths, tiles, and the lights and reflections they share.
 */
export async function createWorld(
  renderer: WebGLRenderer,
  quality: AmbianceQuality,
  initial: ScenePalette,
) {
  let palette = initial;
  const scene = new Scene();
  const sky = createSky(palette);
  const floor = createFloor(palette);
  const motes = createMotes(quality.motes, palette);
  const shaft = createShaft(palette);
  const monoliths = createMonoliths(palette);
  const tiles = await createTiles(quality.tiles, palette);
  scene.add(sky.mesh, floor.mesh, motes.points, shaft.mesh);
  scene.add(...monoliths.meshes);
  tiles.addTo(scene);

  const hemi = new HemisphereLight(0xffffff, 0x000000, 0.35);
  const key = new DirectionalLight(0xffffff, 1.6);
  key.position.set(4, 14, 8);
  // A glow rising off the board itself, brighter as it fills.
  const altar = new PointLight(0xffffff, 30, 30, 1.6);
  altar.position.set(0, 1.2, 0);
  scene.add(hemi, key, altar);

  let environment = buildEnvironment(renderer, palette);

  function setPalette(p: ScenePalette) {
    palette = p;
    renderer.toneMappingExposure = p.exposure;
    renderer.setClearColor(p.fog);
    sky.setPalette(p);
    floor.setPalette(p);
    motes.setPalette(p);
    shaft.setPalette(p);
    monoliths.setPalette(p);
    tiles.setPalette(p);
    hemi.color.copy(p.skyHorizon);
    hemi.groundColor.copy(p.floorBase);
    altar.color.copy(p.accent).multiplyScalar(p.additive ? 1 : 0.3);
    environment.dispose();
    environment = buildEnvironment(renderer, p);
    scene.environment = environment;
  }
  setPalette(palette);

  return {
    scene,
    floor,
    tiles,
    get palette() {
      return palette;
    },
    setPalette,
    update(
      time: number,
      dt: number,
      mood: WorldMood,
      surge: number,
      appear: number,
      camera: Vector3,
      pixelRatio: number,
    ) {
      sky.update(time, camera.x, camera.y, camera.z);
      floor.update(time, mood.energy, mood.progress);
      motes.update(time, surge * 1.5, mood.energy, pixelRatio);
      shaft.update(time, mood.shaft);
      tiles.update(
        time,
        dt,
        mood.spread,
        surge,
        appear,
        mood.energy + surge * 0.5,
        camera,
      );
      altar.intensity =
        (palette.additive ? 18 : 6) * (0.4 + mood.energy + mood.progress);
    },
    dispose() {
      sky.dispose();
      floor.dispose();
      motes.dispose();
      shaft.dispose();
      monoliths.dispose();
      tiles.dispose();
      environment.dispose();
    },
  };
}
