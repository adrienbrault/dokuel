import { type PerspectiveCamera, Vector3 } from "three";
import type { AmbianceScene } from "../lib/ambiance.ts";
import { damp } from "./damp.ts";

/**
 * Direction from the board up to the camera during a game: pitched low
 * enough that the floor recedes into fog and the rival's board shows
 * beyond the player's, high enough that the board still reads as a
 * surface.
 */
const GAME_PITCH = (34 * Math.PI) / 180;
const GAME_VIEW = new Vector3(0, Math.sin(GAME_PITCH), Math.cos(GAME_PITCH));

/**
 * The camera operator. Each scene has a framing it eases toward, so
 * navigating between screens is a camera move through one world rather
 * than a page swap. The pointer adds a little parallax.
 */
export function createRig(camera: PerspectiveCamera) {
  const position = new Vector3(0, 30, 40);
  const look = new Vector3(0, 2, 0);
  const wantPos = new Vector3();
  const wantLook = new Vector3();
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let width = 1;
  let height = 1;

  /** Where the camera wants to be for this scene at this aspect. */
  function frame(scene: AmbianceScene, time: number) {
    const aspect = camera.aspect;
    const portrait = aspect < 1;
    if (scene === "game") {
      camera.fov = portrait ? 56 : 40;
      // Fit a board-and-a-bit of floor across the narrow side of the
      // screen, so ripples rise from around the board the player sees.
      const halfV = (camera.fov * Math.PI) / 360;
      const halfH = Math.atan(Math.tan(halfV) * aspect);
      const fit = portrait ? 5.2 : 5.5;
      const dist = Math.min(26, fit / Math.tan(Math.min(halfV, halfH)));
      wantLook.set(0, 0, -1.5);
      wantPos.copy(wantLook).addScaledVector(GAME_VIEW, dist);
      wantPos.x += pointer.sx * 0.5;
      wantPos.z += pointer.sy * 0.35;
      return;
    }
    camera.fov = portrait ? 58 : 45;
    const dist = portrait ? 17 + (1 - aspect) * 6 : 15.5;
    const sway = Math.sin(time * 0.045) * 0.16;
    // Near eye level: the horizon sits just above the middle of the
    // screen, tiles hang in the air around the menu, monoliths line the
    // skyline.
    wantLook.set(0, 2.9, 0);
    wantPos.set(
      Math.sin(sway) * dist + pointer.sx * 1.2,
      3.6 - pointer.sy * 0.6,
      Math.cos(sway) * dist,
    );
  }

  function apply() {
    camera.position.copy(position);
    camera.lookAt(look);
    camera.updateProjectionMatrix();
  }

  return {
    position,
    setViewport(w: number, h: number) {
      width = w;
      height = h;
      camera.aspect = w / h;
    },
    onPointerMove(e: PointerEvent) {
      pointer.x = (e.clientX / width) * 2 - 1;
      pointer.y = (e.clientY / height) * 2 - 1;
    },
    update(scene: AmbianceScene, time: number, dt: number, rate: number) {
      pointer.sx = damp(pointer.sx, pointer.x, 2, dt);
      pointer.sy = damp(pointer.sy, pointer.y, 2, dt);
      frame(scene, time);
      position.x = damp(position.x, wantPos.x, rate, dt);
      position.y = damp(position.y, wantPos.y, rate, dt);
      position.z = damp(position.z, wantPos.z, rate, dt);
      look.x = damp(look.x, wantLook.x, rate, dt);
      look.y = damp(look.y, wantLook.y, rate, dt);
      look.z = damp(look.z, wantLook.z, rate, dt);
      apply();
    },
    /** Jump straight to the current framing, skipping the glide. */
    snap(scene: AmbianceScene, time: number) {
      frame(scene, time);
      position.copy(wantPos);
      look.copy(wantLook);
      apply();
    },
  };
}
