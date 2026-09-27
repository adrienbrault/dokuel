import { type RefObject, useEffect, useRef } from "react";
import { boardSizePx } from "../lib/board-layout.ts";
import {
  BoardScene,
  type BoardSceneState,
  SCENE_MARGIN,
} from "../lib/board-scene/scene.ts";

type BoardSceneLayerProps = {
  /** The DOM grid on top, whose pointer events drive hover and tilt. */
  gridRef: RefObject<HTMLDivElement | null>;
  cellPx: number;
  state: BoardSceneState;
  /** True once the first frame is on screen; false if WebGL is lost. */
  onActiveChange: (active: boolean) => void;
};

/**
 * Hosts the WebGL board under the DOM grid. The grid keeps every
 * gesture, focus and screen-reader duty; this layer only draws. Loaded
 * lazily so three.js stays out of the main bundle.
 */
export default function BoardSceneLayer({
  gridRef,
  cellPx,
  state,
  onActiveChange,
}: BoardSceneLayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BoardScene | null>(null);
  const onActiveRef = useRef(onActiveChange);
  onActiveRef.current = onActiveChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // The canvas is created here rather than rendered: a disposed
    // renderer loses its context, and a remount (StrictMode, HMR) must
    // not inherit that dead context from a reused element.
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    host.appendChild(canvas);
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let scene: BoardScene;
    try {
      scene = new BoardScene(canvas, reduced, () => onActiveRef.current(true));
    } catch {
      canvas.remove();
      return;
    }
    sceneRef.current = scene;
    const onLost = (e: Event) => {
      e.preventDefault();
      onActiveRef.current(false);
    };
    canvas.addEventListener("webglcontextlost", onLost);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      onActiveRef.current(false);
      scene.dispose();
      sceneRef.current = null;
      canvas.remove();
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setLayout(cellPx);
    scene.update(state);
  });

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const local = (e: PointerEvent) => {
      const rect = grid.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top] as const;
    };
    const move = (e: PointerEvent) => {
      const [x, y] = local(e);
      sceneRef.current?.setPointer(x, y);
    };
    const down = (e: PointerEvent) => {
      const [x, y] = local(e);
      sceneRef.current?.press(x, y);
      sceneRef.current?.setPointer(x, y);
    };
    const up = (e: PointerEvent) => {
      // A finger has no hover: once it lifts, the board settles back.
      if (e.pointerType !== "mouse") sceneRef.current?.setPointer(null);
    };
    const leave = () => sceneRef.current?.setPointer(null);
    grid.addEventListener("pointermove", move, { passive: true });
    grid.addEventListener("pointerdown", down, { passive: true });
    grid.addEventListener("pointerup", up, { passive: true });
    grid.addEventListener("pointercancel", up, { passive: true });
    grid.addEventListener("pointerleave", leave, { passive: true });
    return () => {
      grid.removeEventListener("pointermove", move);
      grid.removeEventListener("pointerdown", down);
      grid.removeEventListener("pointerup", up);
      grid.removeEventListener("pointercancel", up);
      grid.removeEventListener("pointerleave", leave);
    };
  }, [gridRef]);

  const size = boardSizePx(cellPx) + SCENE_MARGIN * 2;
  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      data-testid="board-3d"
      className="absolute pointer-events-none"
      style={{
        left: -SCENE_MARGIN,
        top: -SCENE_MARGIN,
        width: size,
        height: size,
      }}
    />
  );
}
