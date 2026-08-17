import type { Board, Position } from "./types.ts";

/** What the player did to a digit. Widened as gestures are routed. */
export type DigitGesture = { kind: "tap" } | { kind: "hold" };

/** The selection state the answer depends on. Nothing more is read. */
export type DigitIntentContext = {
  board: Board;
  selectedCell: Position | null;
  selectedCells: Set<number>;
};

/**
 * What lands on the board. `at: null` means "into the current
 * selection" — the engine reads the selection itself, which is what
 * makes the ordering in `after` load-bearing.
 */
export type DigitEffect =
  | { kind: "none" }
  | { kind: "toggleHighlight" }
  | { kind: "value"; at: Position | null }
  | { kind: "note"; at: Position | null };

export type DigitIntent = {
  effect: DigitEffect;
  after: {
    /** Keep the selection, drop it, or move it to a cell. */
    selection: "keep" | "release" | Position;
    /** Spotlight this digit board-wide once the effect has landed. */
    highlight: boolean;
  };
  /** What the numpad legend and key faces say a tap will do. */
  label: "enter" | "note";
};

function intent(
  effect: DigitEffect,
  selection: "keep" | "release" | Position = "keep",
  highlight = false,
): DigitIntent {
  // The legend cannot disagree with the behaviour: both read the effect.
  return { effect, after: { selection, highlight }, label: labelFor(effect) };
}

function labelFor(effect: DigitEffect): "enter" | "note" {
  return effect.kind === "note" ? "note" : "enter";
}

/**
 * The single answer to "what does digit n do right now" — the effect on
 * the board, what happens to the selection and the highlight afterwards,
 * and the label the numpad shows for it.
 *
 * The digit itself is not an input: every rule depends on the gesture
 * and the selection, never on which digit. `applyDigitIntent` supplies
 * the digit when it runs the result.
 */
export function digitIntent(
  gesture: DigitGesture,
  ctx: DigitIntentContext,
): DigitIntent {
  switch (gesture.kind) {
    case "tap":
      return tapIntent(ctx);
    case "hold":
      // Stub so the commit typechecks; the hold rules land next.
      return intent({ kind: "none" });
  }
}

function tapIntent(ctx: DigitIntentContext): DigitIntent {
  if (ctx.selectedCell === null && ctx.selectedCells.size === 0) {
    return intent({ kind: "toggleHighlight" });
  }
  // A range is armed: the only meaningful bulk action is a pencil note.
  // Same semantics as dropping a note from a numpad drag — the note
  // lands, the selection is released, and the board highlights the noted
  // digit, so the NEXT tap toggles another digit's highlight (the
  // scan-the-grid rhythm).
  if (ctx.selectedCells.size > 1) {
    return intent({ kind: "note", at: null }, "release", true);
  }
  const cell = ctx.selectedCell
    ? ctx.board[ctx.selectedCell.row]?.[ctx.selectedCell.col]
    : undefined;
  // A tap cannot overwrite a filled cell, so it is repurposed: drop the
  // selection and spotlight the digit instead.
  if (cell && cell.value !== null) {
    return intent({ kind: "none" }, "release", true);
  }
  return intent({ kind: "value", at: null });
}
