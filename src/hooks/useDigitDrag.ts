import { useCallback, useEffect, useRef, useState } from "react";
import {
  cellHitFromPoint,
  type DigitDropMode,
  digitButtonAt,
  liftForPointerType,
  skimDigitOf,
} from "../lib/numpad-gesture.ts";
import type { NumPadGesturePoint, Position } from "../lib/types.ts";

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
  /** Which slot the current pointer position would land in. */
  mode: DigitDropMode;
  /**
   * Hit-test/chip offset above the pointer, in CSS pixels. Non-zero
   * only for touch — see liftForPointerType.
   */
  lift: number;
};

/** The gesture packet plus where the carried digit came from. */
type StartParams = NumPadGesturePoint & { source: DigitDragSource };

type Options = {
  onDrop: (
    digit: number,
    source: DigitDragSource,
    target: Position,
    mode: DigitDropMode,
  ) => void;
  isDroppable: (row: number, col: number, digit: number) => boolean;
  /**
   * Called when a numpad-sourced drag is brought back over the numpad
   * digits after it had left them. The drag is cancelled (no
   * placement) and the gesture is handed back so the numpad can resume
   * a skim under the same pointer.
   */
  onReturnToNumpad?:
    | ((info: {
        digit: number;
        pointerId: number;
        pointerType: string;
      }) => void)
    | undefined;
};

export function useDigitDrag({
  onDrop,
  isDroppable,
  onReturnToNumpad,
}: Options) {
  const [state, setState] = useState<DigitDragState | null>(null);
  const [activePointerId, setActivePointerId] = useState<number | null>(null);
  // Keep the latest callbacks in refs so the document-level listeners we
  // bind on `start` always see fresh values without re-binding on every
  // render — the listeners' lifecycle is tied to the drag, not to React.
  const onDropRef = useRef(onDrop);
  const isDroppableRef = useRef(isDroppable);
  const onReturnToNumpadRef = useRef(onReturnToNumpad);
  onDropRef.current = onDrop;
  isDroppableRef.current = isDroppable;
  onReturnToNumpadRef.current = onReturnToNumpad;
  // Live mirror of `state` for the document listeners (and the drop
  // logic), updated at every transition rather than on render: a final
  // pointermove and the pointerup can land inside one React batch, and
  // a render-synced ref would still hold the previous target then.
  const stateRef = useRef<DigitDragState | null>(null);
  const applyState = useCallback(
    (updater: (prev: DigitDragState | null) => DigitDragState | null): void => {
      const next = updater(stateRef.current);
      stateRef.current = next;
      setState(next);
    },
    [],
  );
  const pointerTypeRef = useRef("touch");
  // Latches true once the drag's finger has been seen off the numpad.
  // Only then does a return over the numpad demote the drag — a drag
  // classified while the finger still covers its numpad button would
  // otherwise cancel itself on the very next move.
  const leftNumpadRef = useRef(false);

  const end = useCallback(
    (commit: boolean) => {
      setActivePointerId(null);
      // Side effects stay OUT of setState: updaters are double-invoked
      // under StrictMode, and the note drop is a toggle — calling
      // onDrop inside the updater made dropped pencil marks vanish in
      // dev builds.
      const current = stateRef.current;
      applyState(() => null);
      if (current && commit && current.target && !current.invalidTarget) {
        onDropRef.current(
          current.digit,
          current.source,
          current.target,
          current.mode,
        );
      }
    },
    [applyState],
  );

  useEffect(() => {
    if (activePointerId === null) return;
    const ownPointerId = activePointerId;

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== ownPointerId) return;
      e.preventDefault();
      const current = stateRef.current;
      if (!current) return;

      // A numpad-sourced drag brought back over the numpad digits —
      // after having left them — is demoted: cancel the drag and hand
      // the gesture back so the finger resumes skimming/highlighting.
      // The raw pointer point, not the lifted aim point: re-entry is
      // decided by the finger itself, not by the cell it points at.
      if (current.source.kind === "numpad" && onReturnToNumpadRef.current) {
        const numpadDigit = skimDigitOf(digitButtonAt(e.clientX, e.clientY));
        if (numpadDigit === null) {
          leftNumpadRef.current = true;
        } else if (leftNumpadRef.current) {
          end(false);
          onReturnToNumpadRef.current({
            digit: numpadDigit,
            pointerId: ownPointerId,
            pointerType: pointerTypeRef.current,
          });
          return;
        }
      }

      const hit = cellHitFromPoint(e.clientX, e.clientY, current.lift);
      const invalid =
        hit !== null &&
        !isDroppableRef.current(
          hit.position.row,
          hit.position.col,
          current.digit,
        );
      applyState((prev) => {
        if (!prev) return prev;
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
  }, [activePointerId, end, applyState]);

  const start = useCallback(
    ({ digit, source, x, y, pointerId, pointerType }: StartParams) => {
      const lift = liftForPointerType(pointerType);
      pointerTypeRef.current = pointerType;
      leftNumpadRef.current = false;
      const hit = cellHitFromPoint(x, y, lift);
      const invalid =
        hit !== null &&
        !isDroppableRef.current(hit.position.row, hit.position.col, digit);
      applyState(() => ({
        digit,
        source,
        x,
        y,
        target: hit?.position ?? null,
        invalidTarget: invalid,
        mode: hit?.mode ?? "value",
        lift,
      }));
      setActivePointerId(pointerId);
    },
    [applyState],
  );

  return { state, start };
}
