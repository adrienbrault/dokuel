import {
  applyDigitIntent,
  type DigitIntentOps,
  digitIntent,
} from "./digit-intent.ts";
import { getConflicts, parsePuzzle } from "./sudoku.ts";
import type { Board, Position } from "./types.ts";

/**
 * The landing page's self-playing demo, as pure data: a script of real
 * gestures and a fold that replays it into the frame the real game
 * would show. Every board effect goes through digitIntent, the same
 * rules the numpad runs in a game, so the demo cannot teach a gesture
 * that behaves differently once the player tries it.
 */

/** One gesture the demo's finger performs. */
export type DemoAction =
  /** Tap a cell to select it. */
  | { kind: "select"; row: number; col: number }
  /** Quick tap on a numpad key. */
  | { kind: "tap"; digit: number }
  /** Press and hold a numpad key: pencils a note, keeps the selection. */
  | { kind: "hold"; digit: number }
  /** Slide along the numpad onto a key: spotlights that digit. */
  | { kind: "skim"; digit: number }
  /** Carry a digit dragged off the numpad over one half of a cell. */
  | ({ kind: "drag" } & DemoDrop)
  /** Let go of a dragged digit over one half of a cell. */
  | ({ kind: "drop" } & DemoDrop);

/**
 * A dragged digit over a cell: the top half commits the value, the
 * bottom half pencils a note (see useDigitDrag).
 */
export type DemoDrop = {
  digit: number;
  row: number;
  col: number;
  mode: "value" | "note";
};

export type DemoStep = {
  action: DemoAction;
  /** How long the frame stays on screen before the next step. */
  ms: number;
  /** One short line saying what the gesture does. */
  caption: string;
};

/** Where the finger is: a board cell or a numpad key. */
export type DemoFinger =
  | { kind: "cell"; row: number; col: number; half?: "top" | "bottom" }
  | { kind: "key"; digit: number };

export type DemoFrame = {
  board: Board;
  selectedCell: Position | null;
  /** The digit spotlighted board-wide when no cell is selected. */
  highlightedDigit: number | null;
  /** The numpad key drawn accented (pressed, or the selection's digit). */
  activeKey: number | null;
  finger: DemoFinger;
  /** Cells in a row/column/box clash, as cellKey numbers. */
  conflicts: Set<number>;
  /** The digit in flight and the cell half it would land in. */
  drag: DemoDrop | null;
  /** A digit a hold is pencilling in, for the in-cell charge animation. */
  chargingDigit: number | null;
  caption: string;
};

type DemoState = {
  board: Board;
  selectedCell: Position | null;
  highlightedDigit: number | null;
};

function opsFor(state: DemoState): DigitIntentOps {
  const selected = () => {
    const at = state.selectedCell;
    const cell = at ? state.board[at.row]![at.col]! : null;
    return cell && !cell.isGiven ? cell : null;
  };
  return {
    placeNumber: (value, asNote) => {
      const cell = selected();
      if (!cell) return;
      if (asNote) {
        if (cell.value === null) cell.notes.add(value);
        return;
      }
      cell.value = value;
      cell.notes = new Set();
    },
    placeNoteAt: (row, col, value) => {
      const cell = state.board[row]![col]!;
      if (!cell.isGiven && cell.value === null) cell.notes.add(value);
    },
    selectCell: (row, col) => {
      state.selectedCell = { row, col };
    },
    deselectCell: () => {
      state.selectedCell = null;
      state.highlightedDigit = null;
    },
    toggleHighlight: (digit) => {
      state.highlightedDigit = state.highlightedDigit === digit ? null : digit;
    },
    setHighlight: (digit) => {
      state.highlightedDigit = digit;
    },
  };
}

function apply(state: DemoState, action: DemoAction): void {
  if (action.kind === "select") {
    state.selectedCell = { row: action.row, col: action.col };
    state.highlightedDigit = null;
    return;
  }
  if (action.kind === "skim") {
    // useDigitHighlight.skimToDigit: the board follows the finger.
    state.selectedCell = null;
    state.highlightedDigit = action.digit;
    return;
  }
  if (action.kind === "drag") return;
  const intent = digitIntent(
    action.kind === "drop"
      ? {
          kind: "drop",
          mode: action.mode,
          target: { row: action.row, col: action.col },
          from: null,
        }
      : { kind: action.kind },
    {
      board: state.board,
      selectedCell: state.selectedCell,
      selectedCells: new Set(),
    },
  );
  applyDigitIntent(intent, action.digit, opsFor(state));
}

function fingerOf(action: DemoAction): DemoFinger {
  switch (action.kind) {
    case "select":
      return { kind: "cell", row: action.row, col: action.col };
    case "tap":
    case "hold":
    case "skim":
      return { kind: "key", digit: action.digit };
    case "drag":
    case "drop":
      return {
        kind: "cell",
        row: action.row,
        col: action.col,
        half: action.mode === "value" ? "top" : "bottom",
      };
  }
}

/**
 * The frame on screen at step `index`: the puzzle with every step up
 * to and including `index` replayed onto it.
 */
export function demoFrame(
  script: readonly DemoStep[],
  puzzle: string,
  index: number,
): DemoFrame {
  const state: DemoState = {
    board: parsePuzzle(puzzle),
    selectedCell: null,
    highlightedDigit: null,
  };
  for (let i = 0; i <= index; i++) apply(state, script[i]!.action);
  const step = script[index]!;
  const { action } = step;
  const finger = fingerOf(action);
  const at = state.selectedCell;
  // Same rule as a game's numpad: the pressed key wins, else the
  // selected cell's digit, else the spotlighted one.
  const restingKey = at
    ? state.board[at.row]![at.col]!.value
    : state.highlightedDigit;
  return {
    board: state.board,
    selectedCell: state.selectedCell,
    highlightedDigit: state.highlightedDigit,
    conflicts: getConflicts(state.board),
    activeKey: finger.kind === "key" ? finger.digit : restingKey,
    drag:
      action.kind === "drag"
        ? {
            digit: action.digit,
            row: action.row,
            col: action.col,
            mode: action.mode,
          }
        : null,
    finger,
    chargingDigit: action.kind === "hold" ? action.digit : null,
    caption: step.caption,
  };
}

/** An easy board with room to play: 46 givens, every demo cell open. */
export const LANDING_DEMO_PUZZLE =
  "534.78...67.19534..983...6.8.9.61.234..853..17.3.2.8.6.6.5..28..8.419..5...286.79";

const PICK = "Tap a cell to select it";
const TAP = "Tap a number to fill it in";
const HOLD = "Hold a number to pencil a note";
const SKIM = "Slide along the pad to spot a digit";
const DRAG = "Drag onto a cell: top half places";
const DRAG_NOTE = "Bottom half pencils a note";

/**
 * The tutorial itself: one pass through every numpad gesture, ending on
 * a deliberate clash so soft validation shows too. Loops forever.
 */
export const LANDING_DEMO_SCRIPT: readonly DemoStep[] = [
  { action: { kind: "select", row: 2, col: 0 }, ms: 1200, caption: PICK },
  {
    action: { kind: "tap", digit: 1 },
    ms: 1400,
    caption: TAP,
  },
  { action: { kind: "select", row: 6, col: 0 }, ms: 1000, caption: PICK },
  {
    action: { kind: "hold", digit: 3 },
    ms: 1400,
    caption: HOLD,
  },
  {
    action: { kind: "hold", digit: 9 },
    ms: 1400,
    caption: "Hold another to stack notes",
  },
  {
    action: { kind: "skim", digit: 4 },
    ms: 450,
    caption: SKIM,
  },
  {
    action: { kind: "skim", digit: 5 },
    ms: 450,
    caption: SKIM,
  },
  {
    action: { kind: "skim", digit: 6 },
    ms: 450,
    caption: SKIM,
  },
  {
    action: { kind: "skim", digit: 7 },
    ms: 1000,
    caption: SKIM,
  },
  {
    action: { kind: "drag", digit: 7, row: 4, col: 6, mode: "value" },
    ms: 1400,
    caption: DRAG,
  },
  {
    action: { kind: "drag", digit: 7, row: 4, col: 6, mode: "note" },
    ms: 1400,
    caption: DRAG_NOTE,
  },
  {
    action: { kind: "drag", digit: 7, row: 4, col: 6, mode: "value" },
    ms: 700,
    caption: DRAG,
  },
  {
    action: { kind: "drop", digit: 7, row: 4, col: 6, mode: "value" },
    ms: 1300,
    caption: "Let go to drop it in",
  },
  { action: { kind: "select", row: 7, col: 0 }, ms: 1000, caption: PICK },
  {
    action: { kind: "tap", digit: 5 },
    ms: 2400,
    caption: "Clashes turn red, never blocked",
  },
];

/**
 * Every gesture at a glance, as [gesture, what it does], for a demo
 * that must hold still. Terser than the captions: all of it has to
 * fit beside the board at once.
 */
export const LANDING_DEMO_SUMMARY: readonly (readonly [string, string])[] = [
  ["Tap", "fills in a number"],
  ["Hold", "pencils a note"],
  ["Slide the pad", "spots a digit"],
  ["Drag to a cell", "top half fills, bottom half notes"],
];

/**
 * The frame a still demo shows: a digit mid-drag over a bottom half,
 * with a value, stacked notes and the skim's highlight already down.
 */
export const LANDING_DEMO_STILL_STEP = LANDING_DEMO_SCRIPT.findIndex(
  (step) => step.caption === DRAG_NOTE,
);
