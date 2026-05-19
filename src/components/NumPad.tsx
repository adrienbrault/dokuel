import {
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { DIGITS } from "../lib/constants.ts";
import { haptics } from "../lib/haptics.ts";
import type { NumPadPosition } from "../lib/types.ts";

const LONG_PRESS_MS = 200;
// Pointer must travel this far from the original button center before
// we classify the gesture (skim vs. drag). Tuned to fingertip-sized slop.
const GESTURE_THRESHOLD_PX = 12;

type NumPadProps = {
  position: NumPadPosition;
  remainingCounts: Record<number, number>;
  selectedValue?: number | null | undefined;
  showRemainingCounts?: boolean | undefined;
  disableCompleted?: boolean | undefined;
  /** Fires on pointerdown (instant note placement / highlight toggle). */
  onNumber: (n: number) => void;
  /** Fires after LONG_PRESS_MS (commits a value over the just-placed note). */
  onLongPressNumber?: ((n: number) => void) | undefined;
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
};

export function NumPad({
  position,
  remainingCounts,
  selectedValue,
  showRemainingCounts = true,
  disableCompleted = false,
  onNumber,
  onLongPressNumber,
  onPressEnd,
  onStartDrag,
  onSkimDigit,
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
  } | null>(null);
  // Suppress the synthetic click that follows pointerdown→pointerup so
  // onNumber doesn't double-fire. A fresh pointerdown clears it.
  const pointerFiredRef = useRef(false);

  // Visual press feedback (drives bg-accent without CSS :active, which
  // sticks on touch devices after pointer-capture release).
  const [pressedDigit, setPressedDigit] = useState<number | null>(null);
  // Active skim gesture id; the effect below attaches doc listeners.
  const [skimPointerId, setSkimPointerId] = useState<number | null>(null);
  // Last digit the finger was over while skimming. Seeded to the originally
  // pressed digit so we don't re-fire onSkimDigit before the finger crosses
  // into a different button.
  const skimDigitRef = useRef<number | null>(null);
  // Keep the latest callbacks fresh for the document listeners without
  // re-binding them every render.
  const onSkimDigitRef = useRef(onSkimDigit);
  const onPressEndRef = useRef(onPressEnd);
  onSkimDigitRef.current = onSkimDigit;
  onPressEndRef.current = onPressEnd;

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
      onNumber(n); // instant note placement / highlight toggle
      const btn = e.currentTarget;
      const rect = btn.getBoundingClientRect();
      const originX = rect.left + rect.width / 2;
      const originY = rect.top + rect.height / 2;
      const timer = onLongPressNumber
        ? setTimeout(() => {
            if (pressRef.current) pressRef.current.timer = null;
            haptics.tap();
            onLongPressNumber(n);
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
      };
    },
    [onNumber, onLongPressNumber, cancelTimer],
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

      // Classify by which axis dominates relative to the numpad's main
      // axis. Along-axis → skim highlights. Perpendicular → drag-to-place.
      const along = isVertical ? Math.abs(dy) : Math.abs(dx);
      const perp = isVertical ? Math.abs(dx) : Math.abs(dy);
      const skim: "skim" | null = onSkimDigit ? "skim" : null;
      const drag: "drag" | null = onStartDrag ? "drag" : null;
      const mode = along >= perp ? (skim ?? drag) : (drag ?? skim);
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
        skimDigitRef.current = press.digit;
        setSkimPointerId(e.pointerId);
      }
    },
    [isVertical, onSkimDigit, onStartDrag, cancelTimer, onPressEnd],
  );

  const handlePointerEnd = useCallback(() => {
    const press = pressRef.current;
    if (!press) return;
    if (press.gestureMode === "skim") {
      // The skim effect's document listeners own end-of-gesture cleanup
      // (including onPressEnd). Just detach this button-scoped state.
      pressRef.current = null;
      return;
    }
    cancelTimer();
    pressRef.current = null;
    setPressedDigit(null);
    onPressEnd?.();
  }, [cancelTimer, onPressEnd]);

  // Skim mode: track the finger as it crosses into other digit buttons.
  useEffect(() => {
    if (skimPointerId === null) return;
    const ownPointerId = skimPointerId;

    const onMove = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== ownPointerId) return;
      e.preventDefault();
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const btn = el
        ? ((el as HTMLElement).closest?.(
            "[data-numpad-digit]",
          ) as HTMLButtonElement | null)
        : null;
      // Skip disabled (completed) digits — they're visually hidden, so
      // briefly highlighting them as the finger drifts over their slot
      // would surprise the user.
      if (!btn || btn.disabled) return;
      const digit = Number(btn.dataset.numpadDigit);
      if (Number.isNaN(digit)) return;
      if (digit === skimDigitRef.current) return;
      skimDigitRef.current = digit;
      setPressedDigit(digit);
      haptics.light();
      onSkimDigitRef.current?.(digit);
    };

    const end = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== ownPointerId) return;
      setSkimPointerId(null);
      skimDigitRef.current = null;
      setPressedDigit(null);
      onPressEndRef.current?.();
    };

    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
    };
  }, [skimPointerId]);

  const handleClick = useCallback(
    (n: number) => () => {
      if (pointerFiredRef.current) {
        pointerFiredRef.current = false;
        return;
      }
      // Keyboard/AT activation: no pointer events fired, so honor click.
      onNumber(n);
    },
    [onNumber],
  );

  return (
    <div
      className={`flex items-center gap-1 ${isVertical ? "flex-col w-12" : "flex-col w-full"} lg:flex-col lg:w-14`}
    >
      {/* Horizontal one-liner: only on mobile bottom position (room to fit) */}
      {!isVertical && (
        <p
          className="text-[0.625rem] text-text-muted leading-tight select-none lg:hidden"
          aria-hidden="true"
        >
          tap = note · hold = enter · drag = place
        </p>
      )}
      {/* Stacked variant: mobile side-positioned numpads, and always on desktop */}
      <p
        className={`text-[0.625rem] text-text-muted leading-tight select-none text-center whitespace-pre-line ${isVertical ? "" : "hidden lg:block"}`}
        aria-hidden="true"
      >
        {"tap\nnote\n· · ·\nhold\nenter\n· · ·\ndrag\nplace"}
      </p>
      <div
        className={`flex gap-1 lg:flex-col lg:w-14 ${isVertical ? "flex-col" : "flex-row justify-center"} ${isVertical ? "w-12" : "w-full lg:w-14"}`}
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

          return (
            <button
              key={n}
              type="button"
              data-numpad-digit={n}
              disabled={(showRemainingCounts || disableCompleted) && isComplete}
              className={`relative flex flex-col items-center justify-center rounded-lg select-none touch-none font-semibold lg:h-10 lg:w-14 ${isVertical ? "h-11 w-12" : "h-14 flex-1"} ${(showRemainingCounts || disableCompleted) && isComplete ? "invisible" : "press-spring"} ${isAccented ? "bg-accent text-text-on-accent shadow-md" : "bg-bg-raised text-text-primary"}`}
              onPointerDown={handlePointerDown(n)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerLeave={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onClick={handleClick(n)}
              aria-label={
                showRemainingCounts
                  ? `${n}, ${remaining} remaining${isSelected ? ", selected" : ""}`
                  : `${n}${isSelected ? ", selected" : ""}`
              }
            >
              <span className="text-lg leading-none">{n}</span>
              {showRemainingCounts && (
                <span
                  className={`text-[0.625rem] leading-none mt-0.5 ${isComplete ? "invisible" : isAccented ? "text-text-on-accent/70" : "text-text-secondary"}`}
                >
                  {remaining}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
