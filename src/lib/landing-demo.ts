import { applyDigitIntent, digitIntent } from "./digit-intent.ts";
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
  | { kind: "tap"; digit: number };

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
  /** The numpad key drawn accented (pressed, or the selection's digit). */
  activeKey: number | null;
  finger: DemoFinger;
  caption: string;
};

type DemoState = {
  board: Board;
  selectedCell: Position | null;
};

function apply(state: DemoState, action: DemoAction): void {
  switch (action.kind) {
    case "select":
      state.selectedCell = { row: action.row, col: action.col };
      return;
    case "tap":
      applyDigitIntent(
        digitIntent(
          { kind: "tap" },
          {
            board: state.board,
            selectedCell: state.selectedCell,
            selectedCells: new Set(),
          },
        ),
        action.digit,
        {
          placeNumber: (value) => {
            const at = state.selectedCell;
            if (!at) return;
            const cell = state.board[at.row]![at.col]!;
            if (cell.isGiven) return;
            cell.value = value;
            cell.notes = new Set();
          },
          placeNoteAt: () => {},
          selectCell: (row, col) => {
            state.selectedCell = { row, col };
          },
          deselectCell: () => {
            state.selectedCell = null;
          },
          toggleHighlight: () => {},
          setHighlight: () => {},
        },
      );
      return;
  }
}

function fingerOf(action: DemoAction): DemoFinger {
  switch (action.kind) {
    case "select":
      return { kind: "cell", row: action.row, col: action.col };
    case "tap":
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
  const state: DemoState = { board: parsePuzzle(puzzle), selectedCell: null };
  for (let i = 0; i <= index; i++) apply(state, script[i]!.action);
  const step = script[index]!;
  const finger = fingerOf(step.action);
  return {
    board: state.board,
    selectedCell: state.selectedCell,
    activeKey: finger.kind === "key" ? finger.digit : null,
    finger,
    caption: step.caption,
  };
}
