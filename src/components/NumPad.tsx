import {
  type PointerEvent,
  type Ref,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useNumPadSkim } from "../hooks/useNumPadSkim.ts";
import { DIGITS } from "../lib/constants.ts";
import { haptics } from "../lib/haptics.ts";
import type { NumPadPosition } from "../lib/types.ts";

const LONG_PRESS_MS = 200;
// Pointer must travel this far from the original button center before
// we classify the gesture (skim vs. drag). Tuned to fingertip-sized slop.
const GESTURE_THRESHOLD_PX = 12;
// Half-angle of the drag cone — the wedge pointing perpendicular to the
// numpad, toward the board. A pan within this many degrees of that axis
// reads as a drag-to-place; a wider pan reads as an along-axis skim.
// The 60° cone (±30°) keeps a diagonal flick toward a neighbouring
// digit on the skim side rather than misfiring a drag.
const DRAG_CONE_HALF_ANGLE_DEG = 30;
const DRAG_CONE_SLOPE = Math.tan((DRAG_CONE_HALF_ANGLE_DEG * Math.PI) / 180);

type NumPadProps = {
  position: NumPadPosition;
  remainingCounts: Record<number, number>;
  selectedValue?: number | null | undefined;
  showRemainingCounts?: boolean | undefined;
  disableCompleted?: boolean | undefined;
  /** Fires on a quick tap — pointerup before the hold threshold (commits the value / toggles highlight). */
  onTapNumber: (n: number) => void;
  /** Fires after LONG_PRESS_MS while still pressed (adds a pencil note). */
  onHoldNumber?: ((n: number) => void) | undefined;
  /** Fires when the press ends (pointerup/cancel/leave or post-drag/skim). */
  onPressEnd?: (() => void) | undefined;
  /**
   * Fires once the finger has slid PERPENDICULAR to the numpad axis,
   * handing control to the parent's drag-and-drop layer.
   */
  onStartDrag?:
    | ((args: {
        digit: number;
        x: number;
        y: number;
        pointerId: number;
        pointerType: string;
      }) => void)
    | undefined;
  /** Fires when an ALONG-axis skim crosses into another digit's button. */
  onSkimDigit?: ((n: number) => void) | undefined;
  /** Imperative handle — see NumPadHandle. */
  ref?: Ref<NumPadHandle> | undefined;
};

/**
 * Imperative surface a parent uses to fold a returning digit drag back
 * into a numpad skim — the reverse of the skim-to-drag handoff.
 */
export type NumPadHandle = {
  /**
   * Resumes a skim for a gesture that began as a drag and has been
   * brought back over the digits. Highlights `digit`, restores the
   * press visual, and re-arms document-level skim tracking under the
   * same pointer.
   */
  resumeSkimFromDrag: (info: {
    digit: number;
    pointerId: number;
    pointerType: string;
  }) => void;
};

export function NumPad({
  position,
  remainingCounts,
  selectedValue,
  showRemainingCounts = true,
  disableCompleted = false,
  onTapNumber,
  onHoldNumber,
  onPressEnd,
  onStartDrag,
  onSkimDigit,
  ref,
}: NumPadProps) {
  const isVertical = position === "left" || position === "right";

  const pressRef = useRef<{
    digit: number;
    timer: ReturnType<typeof setTimeout> | null;
    originX: number;
    originY: number;
    pointerId: number;
    button: HTMLButtonElement;
    gestureMode: "none" | "drag" | "skim";
    holdFired: boolean;
  } | null>(null);
  // Suppress the synthetic click that follows pointerdown→pointerup so
  // onTapNumber doesn't double-fire. A fresh pointerdown clears it.
  const pointerFiredRef = useRef(false);

  // Visual press feedback (drives bg-accent without CSS :active, which
  // sticks on touch devices after pointer-capture release).
  const [pressedDigit, setPressedDigit] = useState<number | null>(null);
  // Once a press is classified as a skim, the gesture is owned at the
  // document level so the finger can be tracked outside this button —
  // and promoted into a drag if it slides off toward the board.
  const { beginSkim, groupRef } = useNumPadSkim({
    position,
    onSkimDigit,
    onPressEnd,
    onStartDrag,
    setPressedDigit,
  });

  useImperativeHandle(
    ref,
    () => ({
      resumeSkimFromDrag: ({ digit, pointerId, pointerType }) => {
        setPressedDigit(digit);
        onSkimDigit?.(digit);
        haptics.tap();
        beginSkim(digit, pointerId, pointerType);
      },
    }),
    [beginSkim, onSkimDigit],
  );

  const cancelTimer = useCallback(() => {
    if (pressRef.current?.timer) {
      clearTimeout(pressRef.current.timer);
      pressRef.current.timer = null;
    }
  }, []);

  const handlePointerDown = useCallback(
    (n: number) => (e: PointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      cancelTimer();
      pointerFiredRef.current = true;
      setPressedDigit(n);
      const btn = e.currentTarget;
      const rect = btn.getBoundingClientRect();
      const originX = rect.left + rect.width / 2;
      const originY = rect.top + rect.height / 2;
      const timer = onHoldNumber
        ? setTimeout(() => {
            const press = pressRef.current;
            if (press) {
              press.timer = null;
              press.holdFired = true;
            }
            haptics.tap();
            onHoldNumber(n);
          }, LONG_PRESS_MS)
        : null;
      pressRef.current = {
        digit: n,
        timer,
        originX,
        originY,
        pointerId: e.pointerId,
        button: btn,
        gestureMode: "none",
        holdFired: false,
      };
    },
    [onHoldNumber, cancelTimer],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      const press = pressRef.current;
      if (!press || press.gestureMode !== "none") return;
      if (e.pointerId !== press.pointerId) return;
      const dx = e.clientX - press.originX;
      const dy = e.clientY - press.originY;
      if (dx * dx + dy * dy < GESTURE_THRESHOLD_PX * GESTURE_THRESHOLD_PX)
        return;

      // Classify by the pan's angle relative to the numpad's main axis.
      // A pan aimed within the drag cone — close to perpendicular,
      // toward the board — is a drag-to-place; a wider pan is an
      // along-axis skim that highlights digits.
      const along = isVertical ? Math.abs(dy) : Math.abs(dx);
      const perp = isVertical ? Math.abs(dx) : Math.abs(dy);
      const skim: "skim" | null = onSkimDigit ? "skim" : null;
      const drag: "drag" | null = onStartDrag ? "drag" : null;
      const withinDragCone = along < perp * DRAG_CONE_SLOPE;
      const mode = withinDragCone ? (drag ?? skim) : (skim ?? drag);
      if (mode === null) return;

      cancelTimer();
      press.gestureMode = mode;
      pointerFiredRef.current = false; // suppress the click that follows
      // Release pointer capture so document-level listeners can see moves
      // outside this button.
      try {
        press.button.releasePointerCapture(e.pointerId);
      } catch {
        // ignore — some browsers don't capture by default
      }
      haptics.tap();

      if (mode === "drag") {
        // Drag ghost shows what's being carried, so the numpad button
        // shouldn't claim "pressed" anymore.
        setPressedDigit(null);
        onStartDrag?.({
          digit: press.digit,
          x: e.clientX,
          y: e.clientY,
          pointerId: e.pointerId,
          pointerType: e.pointerType,
        });
        onPressEnd?.();
      } else {
        beginSkim(press.digit, e.pointerId, e.pointerType);
      }
    },
    [isVertical, onSkimDigit, onStartDrag, cancelTimer, onPressEnd, beginSkim],
  );

  // End-of-press cleanup. `commit` is true only for pointerup: a quick
  // release that never became a hold, drag, or skim commits the tapped
  // value. A pointerleave/cancel passes false — a finger sliding off the
  // button is a cancel, not a tap. Skim end-of-gesture is owned by the
  // skim hook's document listeners, so we only detach button state.
  const endPress = useCallback(
    (commit: boolean) => {
      const press = pressRef.current;
      if (!press) return;
      if (press.gestureMode === "skim") {
        pressRef.current = null;
        return;
      }
      cancelTimer();
      if (commit && !press.holdFired && press.gestureMode === "none") {
        onTapNumber(press.digit);
      }
      pressRef.current = null;
      setPressedDigit(null);
      onPressEnd?.();
    },
    [cancelTimer, onPressEnd, onTapNumber],
  );

  const handleClick = useCallback(
    (n: number) => () => {
      if (pointerFiredRef.current) {
        pointerFiredRef.current = false;
        return;
      }
      // Keyboard/AT activation: no pointer events fired, so honor click.
      onTapNumber(n);
    },
    [onTapNumber],
  );

  return (
    <div
      ref={groupRef}
      className={`flex gap-1.5 ${isVertical ? "flex-col w-13 lg:w-16" : "flex-row justify-center w-full"}`}
      role="group"
      aria-label="Number pad"
    >
      {DIGITS.map((n) => {
        const remaining = remainingCounts[n];
        const isComplete = remaining === 0;
        const isSelected = selectedValue === n;
        // Press state overrides selectedValue so the visual follows
        // the finger across skim transitions.
        const isAccented =
          pressedDigit !== null ? pressedDigit === n : isSelected;
        const isDone = (showRemainingCounts || disableCompleted) && isComplete;

        return (
          <button
            key={n}
            type="button"
            data-numpad-digit={n}
            data-done={isDone ? "true" : undefined}
            disabled={isDone}
            className={`relative flex flex-col items-center justify-center rounded-control select-none touch-none font-bold ${
              isVertical ? "h-12 w-13 lg:h-14 lg:w-16" : "h-14 flex-1 lg:h-16"
            } ${
              isDone
                ? "bg-bg-inset text-text-disabled cursor-default"
                : isAccented
                  ? "bg-accent text-text-on-accent press-spring"
                  : "bg-surface text-text-primary border border-border-default press-spring"
            }`}
            style={
              isDone
                ? undefined
                : {
                    boxShadow: isAccented
                      ? "var(--elevation-accent)"
                      : "var(--elevation-1)",
                  }
            }
            onPointerDown={handlePointerDown(n)}
            onPointerMove={handlePointerMove}
            onPointerUp={() => endPress(true)}
            onPointerLeave={() => endPress(false)}
            onPointerCancel={() => endPress(false)}
            onClick={handleClick(n)}
            aria-label={
              showRemainingCounts
                ? `${n}, ${remaining} remaining${isSelected ? ", selected" : ""}`
                : `${n}${isSelected ? ", selected" : ""}`
            }
          >
            <span
              className={`text-xl lg:text-2xl leading-none ${isDone ? "opacity-35" : ""}`}
            >
              {n}
            </span>
            {/* A finished digit keeps its key rather than vanishing: a
                hole in the row reads as a rendering bug, and "this one is
                done" is itself useful information mid-puzzle. */}
            {isDone ? (
              <span
                className="absolute inset-x-3 h-px bg-current opacity-45"
                aria-hidden="true"
              />
            ) : (
              showRemainingCounts && (
                <span
                  className={`text-[0.6875rem] lg:text-xs font-semibold leading-none mt-1 tabular-nums ${
                    isAccented ? "text-text-on-accent/75" : "text-text-muted"
                  }`}
                >
                  {remaining}
                </span>
              )
            )}
          </button>
        );
      })}
    </div>
  );
}
