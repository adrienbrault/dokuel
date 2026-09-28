import { type RefObject, useEffect, useRef } from "react";
import type { BoardScene } from "../three/board-scene.ts";
import type { SceneSnapshot } from "../three/scene-state.ts";
import { type BoardPointer, useBoardPointer } from "./useBoardPointer.ts";
import {
  type SceneEnv,
  type SceneFactory,
  useBoardScene,
} from "./useBoardScene.ts";

export type BoardLayerOptions = {
  /** Paper mode paints a printed sheet; the scene stays out of it. */
  enabled: boolean;
  /** Square edge of the board box, in CSS pixels. */
  boardPx: number;
  completed: boolean;
  onSelectCell: (row: number, col: number) => void;
  /** Builds the scene's view of the board from the game's state. */
  build: (env: SceneEnv, hover: number | null) => SceneSnapshot;
  create?: SceneFactory;
};

export type BoardLayer = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Whether the scene is painting the board. */
  active: boolean;
  pointer: BoardPointer;
};

/**
 * Connects a board to its scene: the canvas ref, the pointer, and the
 * one moment that is not a state change — the solve.
 */
export function useBoardLayer(options: BoardLayerOptions): BoardLayer {
  const { enabled, boardPx, completed, onSelectCell, build, create } = options;

  // The scene is created in an effect, so it arrives one render after the
  // board first paints. Nothing can be pointed at before that first paint,
  // so reading last render's scene costs nothing and keeps the hover out of
  // the scene's own render pass.
  const previous = useRef<{ scene: BoardScene | null; active: boolean }>({
    scene: null,
    active: false,
  });
  const pointer = useBoardPointer(
    previous.current.scene,
    previous.current.active,
    onSelectCell,
  );
  const layer = useBoardScene({
    enabled,
    boardPx,
    build: (env) => build(env, pointer.hover),
    ...(create ? { create } : {}),
  });
  previous.current = { scene: layer.scene, active: layer.active };

  // The solve is one moment per board: the scene lifts the digits in a wave
  // outward from the centre, so it is told once when the board flips to
  // complete, and again only when a fresh board earns one.
  const celebrated = useRef(false);
  const scene = layer.scene;
  useEffect(() => {
    if (!completed) {
      celebrated.current = false;
      return;
    }
    if (celebrated.current || !scene) return;
    celebrated.current = true;
    scene.celebrate();
  }, [completed, scene]);

  return { canvasRef: layer.canvasRef, active: layer.active, pointer };
}
