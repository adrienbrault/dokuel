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
  /**
   * Hit-test/chip offset above the pointer, in CSS pixels. Non-zero
   * only for touch — see liftForPointerType.
   */
  lift: number;
};

type StartParams = {
  digit: number;
  source: DigitDragSource;
  x: number;
  y: number;
  pointerId: number;
  /** From PointerEvent.pointerType — "touch" | "mouse" | "pen". */
  pointerType: string;
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
 * Baseline upward offset applied to every drag so the chip floats
 * clear above the pointer instead of sitting right on top of it.
 */
const POINTER_LIFT_BASE_PX = 20;

/**
 * Extra lift for touch. A fingertip occludes the cell directly
 * underneath it, so the hit point — and the chip — are raised
 * further clear of the hand. Mouse and pen are precise pointers
 * that occlude nothing, so they only get the baseline offset.
 */
const TOUCH_EXTRA_LIFT_PX = 36;

export function liftForPointerType(pointerType: string): number {
  return (
    POINTER_LIFT_BASE_PX + (pointerType === "touch" ? TOUCH_EXTRA_LIFT_PX : 0)
  );
}

function cellHitFromPoint(
  pointerX: number,
  pointerY: number,
  lift: number,
): CellHit | null {
  const x = pointerX;
  const y = pointerY - lift;
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
      setState((prev) => {
        if (!prev) return prev;
        const hit = cellHitFromPoint(e.clientX, e.clientY, prev.lift);
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
    ({ digit, source, x, y, pointerId, pointerType }: StartParams) => {
      const lift = liftForPointerType(pointerType);
      const hit = cellHitFromPoint(x, y, lift);
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
        lift,
      });
      setActivePointerId(pointerId);
    },
    [],
  );

  return { state, start };
}
