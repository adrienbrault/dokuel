import type { Board, Position } from "./types.ts";

/** What the player did to a digit. Widened as gestures are routed. */
export type DigitGesture = { kind: "tap" };

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
  _gesture: DigitGesture,
  _ctx: DigitIntentContext,
): DigitIntent {
  // Stub so the commit typechecks; the tap rules land next.
  return {
    effect: { kind: "none" },
    after: { selection: "keep", highlight: false },
    label: "enter",
  };
}
