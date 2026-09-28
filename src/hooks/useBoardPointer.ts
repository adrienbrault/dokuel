import { useCallback, useRef, useState } from "react";
import { cellKey } from "../lib/sudoku.ts";
import type { BoardScene } from "../three/board-scene.ts";

/** Where the pointer is, and what to do about it. */
export type BoardPointer = {
  /** Cell key under the pointer, or null. Feeds the scene's hover. */
  hover: number | null;
  onPointerMove(event: { clientX: number; clientY: number }): void;
  onPointerLeave(): void;
  onPointerDown(event: { clientX: number; clientY: number }): void;
};

/**
 * Turns the container's pointer traffic into scene state.
 *
 * While the scene is painting it owns the canvas, so the cells beneath
 * never see an event: the hovered tile has to be found by asking the
 * scene which cell the pointer lands on, and a press has to choose the
 * cell the same way. With no scene the events keep bubbling to the
 * painted cells untouched, exactly as they always did.
 */
export function useBoardPointer(
  scene: BoardScene | null,
  active: boolean,
  onSelectCell: (row: number, col: number) => void,
): BoardPointer {
  const [hover, setHover] = useState<number | null>(null);
  // React bails out of a same-value update only after deciding to render,
  // so the comparison happens here instead: the board is re-rendered when
  // the pointer crosses into a new cell and not before.
  const lastHover = useRef<number | null>(null);

  const remember = useCallback((next: number | null) => {
    if (lastHover.current === next) return;
    lastHover.current = next;
    setHover(next);
  }, []);

  const onPointerMove = useCallback(
    (event: { clientX: number; clientY: number }) => {
      if (!active || !scene) return;
      scene.setPointer(event.clientX, event.clientY);
      const hit = scene.hitTest(event.clientX, event.clientY);
      remember(hit ? cellKey(hit.row, hit.col) : null);
    },
    [active, remember, scene],
  );

  const onPointerLeave = useCallback(() => {
    if (!active || !scene) return;
    scene.setPointer(null, null);
    remember(null);
  }, [active, remember, scene]);

  const onPointerDown = useCallback(
    (event: { clientX: number; clientY: number }) => {
      if (!active || !scene) return;
      const hit = scene.hitTest(event.clientX, event.clientY);
      if (hit) onSelectCell(hit.row, hit.col);
    },
    [active, scene, onSelectCell],
  );

  return { hover, onPointerMove, onPointerLeave, onPointerDown };
}
