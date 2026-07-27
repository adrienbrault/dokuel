import type { PointerEvent } from "react";

type NumPadKeyProps = {
  digit: number;
  /** How many of this digit are still unplaced. */
  remaining: number | undefined;
  /** Print the remaining count under the digit (full-assist mode). */
  showRemaining: boolean;
  /** All nine are placed and the key can no longer enter this digit. */
  isDone: boolean;
  /** Carries the accent — either pressed right now, or the active digit. */
  isAccented: boolean;
  /** Drives the aria-label suffix; a pressed key is not necessarily active. */
  isSelected: boolean;
  isVertical: boolean;
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onClick: () => void;
};

/**
 * One key of the number pad. Presentation only — every gesture decision
 * (tap vs hold vs skim vs drag) is made by NumPad and its skim hook, which
 * hand this component plain pointer callbacks.
 */
export function NumPadKey({
  digit,
  remaining,
  showRemaining,
  isDone,
  isAccented,
  isSelected,
  isVertical,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  onClick,
}: NumPadKeyProps) {
  return (
    <button
      type="button"
      data-numpad-digit={digit}
      data-done={isDone ? "true" : undefined}
      disabled={isDone}
      className={`relative flex flex-col items-center justify-center rounded-control select-none touch-none font-bold ${
        isVertical ? "h-12 w-13 lg:h-14 lg:w-16" : "h-14 flex-1 lg:h-16"
      } ${
        isDone
          ? "bg-bg-inset text-text-disabled cursor-default"
          : isAccented
            ? "bg-accent-surface text-text-on-accent press-spring"
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
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
      onClick={onClick}
      aria-label={
        showRemaining
          ? `${digit}, ${remaining} remaining${isSelected ? ", selected" : ""}`
          : `${digit}${isSelected ? ", selected" : ""}`
      }
    >
      <span
        className={`text-xl lg:text-2xl leading-none ${isDone ? "opacity-35" : ""}`}
      >
        {digit}
      </span>
      {/* A finished digit keeps its key rather than vanishing: a hole in
          the row reads as a rendering bug, and "this one is done" is
          itself useful information mid-puzzle. */}
      {isDone ? (
        <span
          className="absolute inset-x-3 h-px bg-current opacity-45"
          aria-hidden="true"
        />
      ) : (
        showRemaining && (
          <span
            className={`text-[0.6875rem] lg:text-xs font-semibold leading-none mt-1 tabular-nums ${
              isAccented ? "text-text-on-accent-muted" : "text-text-muted"
            }`}
          >
            {remaining}
          </span>
        )
      )}
    </button>
  );
}
