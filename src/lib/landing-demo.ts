import {
  applyDigitIntent,
  type DigitIntentOps,
  digitIntent,
} from "./digit-intent.ts";
import { parsePuzzle } from "./sudoku.ts";
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
  | { kind: "skim"; digit: number };

export type DemoStep = {
  action: DemoAction;
  /** How long the frame stays on screen before the next step. */
  ms: number;
  /** One short line saying what the gesture does. */
  caption: string;
};

/** Where the finger is: a board cell or a numpad key. */
export type DemoFinger =
  | { kind: "cell"; row: number; col: number }
  | { kind: "key"; digit: number };

export type DemoFrame = {
  board: Board;
  selectedCell: Position | null;
  /** The digit spotlighted board-wide when no cell is selected. */
  highlightedDigit: number | null;
  /** The numpad key drawn accented (pressed, or the selection's digit). */
  activeKey: number | null;
  finger: DemoFinger;
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
    placeNoteAt: () => {},
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
  const intent = digitIntent(
    { kind: action.kind },
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
  const finger = fingerOf(step.action);
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
    activeKey: finger.kind === "key" ? finger.digit : restingKey,
    finger,
    chargingDigit: step.action.kind === "hold" ? step.action.digit : null,
    caption: step.caption,
  };
}
