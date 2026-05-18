import { type PointerEvent, useCallback, useRef } from "react";
import { DIGITS } from "../lib/constants.ts";
import { haptics } from "../lib/haptics.ts";
import type { NumPadLayout, NumPadPosition } from "../lib/types.ts";

const LONG_PRESS_MS = 400;
// Pointer must travel this far from the original button center before
// we treat the gesture as a drag (rather than a finger that drifted
// slightly during the tap/hold). Tuned to fingertip-sized slop.
const DRAG_THRESHOLD_PX = 12;

export const NUMPAD_CAPTION = "tap = note · hold = enter · drag = place";

type NumPadProps = {
  position: NumPadPosition;
  layout?: NumPadLayout | undefined;
  remainingCounts: Record<number, number>;
  selectedValue?: number | null | undefined;
  showRemainingCounts?: boolean | undefined;
  disableCompleted?: boolean | undefined;
  /**
   * When true and layout=grid, the horizontal one-liner caption is
   * suppressed — the parent layout renders it elsewhere (e.g. next to
   * the controls) to save vertical space.
   */
  hideCaption?: boolean | undefined;
  /**
   * Fires the moment a digit is pressed (pointerdown) so the cell can
   * show an instant note. In Dokuel this writes a NOTE.
   */
  onNumber: (n: number) => void;
  /**
   * Fires after holding for LONG_PRESS_MS. In Dokuel this COMMITS a
   * value (overwriting the just-placed note).
   */
  onLongPressNumber?: ((n: number) => void) | undefined;
  /**
   * Fires on pointerup / cancel / leave — i.e. the press ended,
   * regardless of whether it crossed the long-press threshold. Used
   * by the parent to clear "currently charging" UI state.
   */
  onPressEnd?: (() => void) | undefined;
  /**
   * Fires once the finger has slid off the button while pressed,
   * handing control to the parent's drag-and-drop layer. The numpad
   * cancels its own tap/hold UI but does not undo the instant note
   * already placed — the user can undo or accept it as a side-effect.
   */
  onStartDrag?:
    | ((args: {
        digit: number;
        x: number;
        y: number;
        pointerId: number;
      }) => void)
    | undefined;
};

export function NumPad({
  position,
  layout = "linear",
  remainingCounts,
  selectedValue,
  showRemainingCounts = true,
  disableCompleted = false,
  hideCaption = false,
  onNumber,
  onLongPressNumber,
  onPressEnd,
  onStartDrag,
}: NumPadProps) {
  const isGrid = layout === "grid";
  const isPositionedSide = position === "left" || position === "right";
  const isVertical = !isGrid && isPositionedSide;
  // Grid on a mobile side position needs smaller buttons or it crowds out
  // the board. Bottom/desktop grids have room for a more generous size.
  const isGridSide = isGrid && isPositionedSide;

  const pressRef = useRef<{
    digit: number;
    timer: ReturnType<typeof setTimeout> | null;
    originX: number;
    originY: number;
    pointerId: number;
    button: HTMLButtonElement;
    dragStarted: boolean;
  } | null>(null);
  // Suppress the synthetic click that follows pointerdown→pointerup so
  // onNumber doesn't double-fire. A fresh pointerdown clears it.
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
      onNumber(n); // instant note placement
      const btn = e.currentTarget;
      const rect = btn.getBoundingClientRect();
      const originX = rect.left + rect.width / 2;
      const originY = rect.top + rect.height / 2;
      if (!onLongPressNumber) {
        pressRef.current = {
          digit: n,
          timer: null,
          originX,
          originY,
          pointerId: e.pointerId,
          button: btn,
          dragStarted: false,
        };
        return;
      }
      const timer = setTimeout(() => {
        if (pressRef.current) pressRef.current.timer = null;
        haptics.tap();
        onLongPressNumber(n);
      }, LONG_PRESS_MS);
      pressRef.current = {
        digit: n,
        timer,
        originX,
        originY,
        pointerId: e.pointerId,
        button: btn,
        dragStarted: false,
      };
    },
    [onNumber, onLongPressNumber, cancelTimer],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      const press = pressRef.current;
      if (!press || press.dragStarted || !onStartDrag) return;
      if (e.pointerId !== press.pointerId) return;
      const dx = e.clientX - press.originX;
      const dy = e.clientY - press.originY;
      if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
      // Drag takes over: cancel hold timer + suppress the trailing click
      // so the only side-effect is the instant note that already fired
      // (which the user can undo if they didn't want it).
      cancelTimer();
      press.dragStarted = true;
      pointerFiredRef.current = false; // ignore the click that follows
      // Release pointer capture so the document-level drag listeners can
      // see subsequent moves outside this button.
      try {
        press.button.releasePointerCapture(e.pointerId);
      } catch {
        // ignore — some browsers don't capture by default
      }
      haptics.tap();
      onStartDrag({
        digit: press.digit,
        x: e.clientX,
        y: e.clientY,
        pointerId: e.pointerId,
      });
      onPressEnd?.();
    },
    [cancelTimer, onStartDrag, onPressEnd],
  );

  const handlePointerEnd = useCallback(() => {
    if (!pressRef.current) return;
    cancelTimer();
    pressRef.current = null;
    onPressEnd?.();
  }, [cancelTimer, onPressEnd]);

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
      className={`flex items-center gap-1 ${isGrid ? (isGridSide ? "flex-col w-fit" : "flex-col w-full max-w-[14rem]") : isVertical ? "flex-col w-12 lg:flex-col lg:w-14" : "flex-col w-full max-w-lg lg:flex-col lg:w-14"}`}
    >
      {/* Horizontal one-liner: mobile bottom (room to fit) and grid layout (compact wrapper).
          hideCaption=true means the parent layout renders this on mobile, so
          we restrict the in-numpad caption to desktop in that case. */}
      {(!isVertical && !isGrid) || isGrid ? (
        <p
          className={`text-[0.625rem] text-text-muted leading-tight select-none text-center ${isGrid ? "max-w-[8rem] lg:max-w-[10rem]" : "lg:hidden"} ${hideCaption ? "hidden lg:block" : ""}`}
          aria-hidden="true"
        >
          {NUMPAD_CAPTION}
        </p>
      ) : null}
      {/* Stacked variant: mobile side-positioned linear numpads, and desktop linear */}
      {!isGrid && (
        <p
          className={`text-[0.625rem] text-text-muted leading-tight select-none text-center ${
            isVertical ? "" : "hidden lg:block"
          }`}
          aria-hidden="true"
        >
          tap
          <br />
          note
          <br />· · ·
          <br />
          hold
          <br />
          enter
          <br />· · ·
          <br />
          drag
          <br />
          place
        </p>
      )}
      <div
        className={
          isGrid
            ? `grid grid-cols-3 gap-1 ${isGridSide ? "" : "w-full"}`
            : `flex gap-1 lg:flex-col lg:w-14 ${isVertical ? "flex-col" : "flex-row justify-center"} ${isVertical ? "w-12" : "w-full max-w-lg lg:w-14"}`
        }
        role="group"
        aria-label="Number pad"
      >
        {DIGITS.map((n) => {
          const remaining = remainingCounts[n];
          const isComplete = remaining === 0;
          const isSelected = selectedValue === n;

          return (
            <button
              key={n}
              type="button"
              disabled={(showRemainingCounts || disableCompleted) && isComplete}
              className={`relative flex flex-col items-center justify-center rounded-lg select-none touch-none font-semibold ${isGrid ? (isGridSide ? "h-10 w-10 lg:h-12 lg:w-14" : "aspect-square w-full") : `lg:h-10 lg:w-14 ${isVertical ? "h-11 w-12" : "h-14 flex-1 max-w-14"}`} ${(showRemainingCounts || disableCompleted) && isComplete ? "invisible" : "press-spring"} ${isSelected ? "bg-accent text-text-on-accent shadow-md" : "bg-bg-raised text-text-primary active:bg-accent active:text-text-on-accent active:shadow-md"}`}
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
                  className={`text-[0.625rem] leading-none mt-0.5 ${isComplete ? "invisible" : isSelected ? "text-text-on-accent/70" : "text-text-secondary"}`}
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
