import { useCallback, useEffect, useRef, useState } from "react";
import type { Position } from "../lib/types.ts";

export type DigitDragSource =
  | { kind: "numpad" }
  | { kind: "cell"; row: number; col: number };

/**
 * Which slot in the cell receives the dropped digit. The cell is split
 * into an inner square (value zone) wrapped by an outer ring (note
 * zone): aiming for the center commits the value, peripheral aim
 * lands a note. The single drag gesture expresses both intents
 * without switching modes.
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

/**
 * Side length of the centered "value" square, as a fraction of the
 * cell. The Cell component renders an inset overlay with the same
 * margin so the visible zone boundary lines up with the hit test.
 */
export const VALUE_ZONE_FRACTION = 0.55;

function cellModeAt(cell: HTMLElement, x: number, y: number): DigitDropMode {
  const rect = cell.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return "value";
  // Square-within-a-square split: aim for the centered inner square
  // (VALUE_ZONE_FRACTION on a side) to commit the value, anywhere
  // else in the cell to commit a note. Notes occupy the outer ring,
  // so the peripheral aim that's easy to slip into still does
  // something useful instead of misfiring as a value.
  const localX = (x - rect.left) / rect.width;
  const localY = (y - rect.top) / rect.height;
  const half = VALUE_ZONE_FRACTION / 2;
  const inInner =
    Math.abs(localX - 0.5) < half && Math.abs(localY - 0.5) < half;
  return inInner ? "value" : "note";
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
