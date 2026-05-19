import { useCallback, useEffect, useRef, useState } from "react";
import type { Position } from "../lib/types.ts";

// Distance from the pointer to the ghost's visual center, in pixels.
// The ghost is rendered above the finger so the digit stays visible on
// touch; hit testing must use the same offset so the highlighted cell
// matches the ghost's apparent location. Keep in sync with DigitDragGhost.
export const DIGIT_DRAG_GHOST_LIFT_PX = 34;

export type DigitDragSource =
  | { kind: "numpad" }
  | { kind: "cell"; row: number; col: number };

export type DigitDragState = {
  digit: number;
  source: DigitDragSource;
  x: number;
  y: number;
  target: Position | null;
  invalidTarget: boolean;
};

type StartParams = {
  digit: number;
  source: DigitDragSource;
  x: number;
  y: number;
  pointerId: number;
};

type Options = {
  onDrop: (digit: number, source: DigitDragSource, target: Position) => void;
  isDroppable: (row: number, col: number, digit: number) => boolean;
};

function cellFromPoint(x: number, y: number): Position | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const btn = (el as HTMLElement).closest?.("[data-row]") as HTMLElement | null;
  if (!btn) return null;
  const row = Number(btn.dataset.row);
  const col = Number(btn.dataset.col);
  if (Number.isNaN(row) || Number.isNaN(col)) return null;
  return { row, col };
}

export function useDigitDrag({ onDrop, isDroppable }: Options) {
  const [state, setState] = useState<DigitDragState | null>(null);
  const [activePointerId, setActivePointerId] = useState<number | null>(null);
  // Keep the latest callbacks in refs so the document-level listeners we
  // bind on `start` always see fresh values without re-binding on every
  // render — the listeners' lifecycle is tied to the drag, not to React.
  const onDropRef = useRef(onDrop);
  const isDroppableRef = useRef(isDroppable);
  onDropRef.current = onDrop;
  isDroppableRef.current = isDroppable;

  const end = useCallback((commit: boolean) => {
    setActivePointerId(null);
    setState((current) => {
      if (current && commit && current.target && !current.invalidTarget) {
        onDropRef.current(current.digit, current.source, current.target);
      }
      return null;
    });
  }, []);

  useEffect(() => {
    if (activePointerId === null) return;
    const ownPointerId = activePointerId;

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== ownPointerId) return;
      e.preventDefault();
      const target = cellFromPoint(
        e.clientX,
        e.clientY - DIGIT_DRAG_GHOST_LIFT_PX,
      );
      setState((prev) => {
        if (!prev) return prev;
        const invalid =
          target !== null &&
          !isDroppableRef.current(target.row, target.col, prev.digit);
        return {
          ...prev,
          x: e.clientX,
          y: e.clientY,
          target,
          invalidTarget: invalid,
        };
      });
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== ownPointerId) return;
      end(true);
    };

    const onCancel = (e: PointerEvent) => {
      if (e.pointerId !== ownPointerId) return;
      end(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") end(false);
    };

    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("keydown", onKey);
    };
  }, [activePointerId, end]);

  const start = useCallback(
    ({ digit, source, x, y, pointerId }: StartParams) => {
      const target = cellFromPoint(x, y - DIGIT_DRAG_GHOST_LIFT_PX);
      const invalid =
        target !== null &&
        !isDroppableRef.current(target.row, target.col, digit);
      setState({
        digit,
        source,
        x,
        y,
        target,
        invalidTarget: invalid,
      });
      setActivePointerId(pointerId);
    },
    [],
  );

  return { state, start };
}
