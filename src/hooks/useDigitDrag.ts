import { useCallback, useEffect, useRef, useState } from "react";
import type { Position } from "../lib/types.ts";

export type DigitDragSource =
  | { kind: "numpad" }
  | { kind: "cell"; row: number; col: number };

/**
 * Which slot in the cell receives the dropped digit. The cell is
 * split horizontally: aim for the top half to commit the value, the
 * bottom half to add a note. A single drag gesture expresses both
 * intents without switching modes mid-drag.
 */
export type DigitDropMode = "value" | "note";

export type DigitDragState = {
  digit: number;
  source: DigitDragSource;
  x: number;
  y: number;
  target: Position | null;
  invalidTarget: boolean;
  /** Which slot the current pointer position would land in. */
  mode: DigitDropMode;
};

type StartParams = {
  digit: number;
  source: DigitDragSource;
  x: number;
  y: number;
  pointerId: number;
};

type Options = {
  onDrop: (
    digit: number,
    source: DigitDragSource,
    target: Position,
    mode: DigitDropMode,
  ) => void;
  isDroppable: (row: number, col: number, digit: number) => boolean;
};

type CellHit = { position: Position; mode: DigitDropMode };

/**
 * How far (in CSS pixels) above the pointer we hit-test. On touch
 * devices the finger occludes the cell directly underneath; lifting
 * the hit point keeps the highlighted cell — and its diagonal drop
 * preview — visible above the user's hand. The lift is small enough
 * that a quick mouse drag still feels natural.
 */
const POINTER_LIFT_PX = 40;

function cellHitFromPoint(pointerX: number, pointerY: number): CellHit | null {
  const x = pointerX;
  const y = pointerY - POINTER_LIFT_PX;
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const btn = (el as HTMLElement).closest?.("[data-row]") as HTMLElement | null;
  if (!btn) return null;
  const row = Number(btn.dataset.row);
  const col = Number(btn.dataset.col);
  if (Number.isNaN(row) || Number.isNaN(col)) return null;
  return { position: { row, col }, mode: cellModeAt(btn, x, y) };
}

function cellModeAt(cell: HTMLElement, _x: number, y: number): DigitDropMode {
  const rect = cell.getBoundingClientRect();
  if (rect.height <= 0) return "value";
  // Horizontal split at the cell's midline: the upper half is the
  // value zone, the lower half is the note zone. Top sits closer to
  // where the pointer enters from above on a numpad drag, which
  // matches the dominant "commit the digit" intent.
  const localY = (y - rect.top) / rect.height;
  return localY < 0.5 ? "value" : "note";
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
        onDropRef.current(
          current.digit,
          current.source,
          current.target,
          current.mode,
        );
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
      const hit = cellHitFromPoint(e.clientX, e.clientY);
      setState((prev) => {
        if (!prev) return prev;
        const invalid =
          hit !== null &&
          !isDroppableRef.current(
            hit.position.row,
            hit.position.col,
            prev.digit,
          );
        return {
          ...prev,
          x: e.clientX,
          y: e.clientY,
          target: hit?.position ?? null,
          invalidTarget: invalid,
          mode: hit?.mode ?? "value",
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
      const hit = cellHitFromPoint(x, y);
      const invalid =
        hit !== null &&
        !isDroppableRef.current(hit.position.row, hit.position.col, digit);
      setState({
        digit,
        source,
        x,
        y,
        target: hit?.position ?? null,
        invalidTarget: invalid,
        mode: hit?.mode ?? "value",
      });
      setActivePointerId(pointerId);
    },
    [],
  );

  return { state, start };
}
