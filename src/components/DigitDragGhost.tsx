import {
  type DigitDragState,
  DRAG_GHOST_LIFT_PX,
} from "../hooks/useDigitDrag.ts";

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
  // whether releasing here would land. The cell underneath gets its
  // own highlight in Board/Cell; this is the pointer-side cue.
  const colorClass =
    dropState === "valid"
      ? "bg-accent text-text-on-accent shadow-accent/60"
      : dropState === "invalid"
        ? "bg-cell-conflict-bg text-cell-conflict shadow-cell-conflict/50"
        : "bg-bg-overlay text-cell-user shadow-black/50";

  // The ghost shrinks for a pending note drop so the pointer-side cue
  // matches the cell-side preview — the user sees a note-sized glyph
  // when they're aiming at the note triangle, value-sized otherwise.
  const isNotePreview = dropState === "valid" && state.mode === "note";
  const sizeRem = isNotePreview ? "2.25rem" : "3.25rem";
  const fontRem = isNotePreview ? "1.1rem" : "1.75rem";

  return (
    <div
      data-testid="digit-drag-ghost"
      data-drop-state={dropState}
      data-drop-mode={dropState === "valid" ? state.mode : undefined}
      aria-hidden="true"
      className={`fixed z-50 pointer-events-none select-none flex items-center justify-center font-bold rounded-xl shadow-2xl drop-shadow-2xl animate-digit-drag-ghost ${colorClass}`}
      style={{
        // Anchor the ghost's center at a fixed point above the finger
        // (DRAG_GHOST_LIFT_PX above the pointer). useDigitDrag's hit
        // test uses the same offset, so the cell under this ghost is
        // the one that gets highlighted — not the cell hidden under
        // the user's hand on touch devices.
        left: state.x,
        top: state.y - DRAG_GHOST_LIFT_PX,
        width: sizeRem,
        height: sizeRem,
        transform: "translate(-50%, -50%)",
        fontSize: fontRem,
        lineHeight: 1,
        transition: "width 0.12s ease, height 0.12s ease, font-size 0.12s ease",
      }}
    >
      {state.digit}
    </div>
  );
}
