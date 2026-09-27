import { useSyncExternalStore } from "react";
import {
  getBoard3DEnabled,
  setBoard3DEnabled,
  subscribeBoard3D,
  supportsWebGL,
} from "../lib/board-3d.ts";

/**
 * The 3D board preference. `enabled` is what the player chose; `active`
 * is whether the board should actually render in WebGL, which also
 * needs a browser that can.
 */
export function useBoard3D() {
  const enabled = useSyncExternalStore(
    subscribeBoard3D,
    getBoard3DEnabled,
    () => false,
  );
  return {
    enabled,
    active: enabled && supportsWebGL(),
    setEnabled: setBoard3DEnabled,
  };
}
