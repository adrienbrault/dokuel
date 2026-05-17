import { useCallback, useEffect, useRef, useState } from "react";
import type { Position } from "../lib/types.ts";

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
  const pointerIdRef = useRef<number | null>(null);
  // Keep the latest callbacks in refs so the document-level listeners we
  // bind on `start` always see fresh values without re-binding on every
  // render — the listeners' lifecycle is tied to the drag, not to React.
  const onDropRef = useRef(onDrop);
  const isDroppableRef = useRef(isDroppable);
  useEffect(() => {
    onDropRef.current = onDrop;
    isDroppableRef.current = isDroppable;
  });

  const end = useCallback((commit: boolean) => {
    pointerIdRef.current = null;
    setState((current) => {
      if (current && commit && current.target && !current.invalidTarget) {
        onDropRef.current(current.digit, current.source, current.target);
      }
      return null;
    });
  }, []);

  useEffect(() => {
    if (state === null) return;
    const ownPointerId = pointerIdRef.current;

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== ownPointerId) return;
      e.preventDefault();
      const target = cellFromPoint(e.clientX, e.clientY);
      setState((prev) => {
        if (!prev) return prev;
        const invalid =
          target !== null && !isDroppableRef.current(target.row, target.col, prev.digit);
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
  }, [state === null, end]);

  const start = useCallback(
    ({ digit, source, x, y, pointerId }: StartParams) => {
      pointerIdRef.current = pointerId;
      const target = cellFromPoint(x, y);
      const invalid =
        target !== null && !isDroppableRef.current(target.row, target.col, digit);
      setState({
        digit,
        source,
        x,
        y,
        target,
        invalidTarget: invalid,
      });
    },
    [],
  );

  return { state, start };
}
