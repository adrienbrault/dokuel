import type { DigitDragState } from "../hooks/useDigitDrag.ts";

type DigitDragGhostProps = {
  state: DigitDragState | null;
};

export function DigitDragGhost({ state }: DigitDragGhostProps) {
  if (!state) return null;

  const dropState = state.target
    ? state.invalidTarget
      ? "invalid"
      : "valid"
    : "none";

  // Tint shifts with drop state so the floating glyph itself signals
  // whether releasing here would land a value. The cell underneath
  // gets its own highlight in Board/Cell; this is the pointer-side cue.
  const colorClass =
    dropState === "valid"
      ? "bg-accent text-text-on-accent shadow-accent/60"
      : dropState === "invalid"
        ? "bg-cell-conflict-bg text-cell-conflict shadow-cell-conflict/50"
        : "bg-bg-overlay text-cell-user shadow-black/50";

  return (
    <div
      data-testid="digit-drag-ghost"
      data-drop-state={dropState}
      aria-hidden="true"
      className={`fixed z-50 pointer-events-none select-none flex items-center justify-center font-bold rounded-xl shadow-2xl drop-shadow-2xl animate-digit-drag-ghost ${colorClass}`}
      style={{
        left: state.x,
        top: state.y,
        width: "3.25rem",
        height: "3.25rem",
        // Anchor the glyph at the pointer's tip while lifting it slightly
        // above so it isn't hidden under the finger on touch devices.
        transform: "translate(-50%, calc(-100% - 0.5rem))",
        fontSize: "1.75rem",
        lineHeight: 1,
      }}
    >
      {state.digit}
    </div>
  );
}
