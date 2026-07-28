import { type PointerEvent, useCallback, useRef } from "react";
import { haptics } from "../lib/haptics.ts";

const LONG_PRESS_MS = 200;
// Pointer must travel this far FROM THE POINTERDOWN POINT before we
// classify the gesture (skim vs. drag). Never measure from the button
// center: an off-center click would start "past the threshold", and a
// few pixels of mouse wobble then misfired a drag/skim.
const GESTURE_THRESHOLD_PX = 12;
// Half-angle of the drag cone — the wedge pointing perpendicular to the
// numpad, toward the board. A pan within this many degrees of that axis
// reads as a drag-to-place; a wider pan reads as an along-axis skim.
// The 60° cone (±30°) keeps a diagonal flick toward a neighbouring
// digit on the skim side rather than misfiring a drag.
const DRAG_CONE_HALF_ANGLE_DEG = 30;
const DRAG_CONE_SLOPE = Math.tan((DRAG_CONE_HALF_ANGLE_DEG * Math.PI) / 180);

type Options = {
  isVertical: boolean;
  /** Fires on a quick tap — pointerup before the hold threshold. */
  onTapNumber: (n: number) => void;
  /** Fires after LONG_PRESS_MS while still pressed. */
  onHoldNumber?: ((n: number) => void) | undefined;
  /** Fires when the press ends (pointerup/cancel/leave or post-drag). */
  onPressEnd?: (() => void) | undefined;
  /** Hands the gesture to the drag-and-drop layer. */
  onStartDrag?:
    | ((args: {
        digit: number;
        x: number;
        y: number;
        pointerId: number;
        pointerType: string;
      }) => void)
    | undefined;
  /** Presence makes along-axis pans eligible to become skims. */
  skimEnabled: boolean;
  /** Arms document-level skim tracking (see useNumPadSkim). */
  beginSkim: (digit: number, pointerId: number, pointerType: string) => void;
  /** Drives the numpad's pressed-digit visual. */
  setPressedDigit: (digit: number | null) => void;
};

/**
 * The per-button press state machine of the numpad: decides whether a
 * press is a tap, a hold, an along-axis skim, or a perpendicular
 * drag-to-place, and fires the matching callback exactly once.
 * Rendering stays in NumPad; document-level skim tracking lives in
 * useNumPadSkim.
 */
export function useNumPadPress({
  isVertical,
  onTapNumber,
  onHoldNumber,
  onPressEnd,
  onStartDrag,
  skimEnabled,
  beginSkim,
  setPressedDigit,
}: Options) {
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
      const originX = e.clientX;
      const originY = e.clientY;
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
    [onHoldNumber, cancelTimer, setPressedDigit],
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
      const skim: "skim" | null = skimEnabled ? "skim" : null;
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
    [
      isVertical,
      skimEnabled,
      onStartDrag,
      cancelTimer,
      onPressEnd,
      beginSkim,
      setPressedDigit,
    ],
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
    [cancelTimer, onPressEnd, onTapNumber, setPressedDigit],
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

  return { handlePointerDown, handlePointerMove, endPress, handleClick };
}
