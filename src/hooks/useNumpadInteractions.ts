import { useCallback, useState } from "react";
import {
  applyDigitIntent,
  type DigitGesture,
  type DigitIntentOps,
  digitIntent,
} from "../lib/digit-intent.ts";
import type { AssistLevel, NumPadPosition } from "../lib/types.ts";
import { useDigitGesture } from "./useDigitGesture.ts";
import { useDigitHighlight } from "./useDigitHighlight.ts";
import type { useSudoku } from "./useSudoku.ts";

type SudokuGame = ReturnType<typeof useSudoku>;

/**
 * Everything the touch numpad needs to talk to a game: digit
 * highlighting, hold-to-note charging, drag-and-drop wiring, and the
 * shared NumPad props. SoloGame and MultiplayerBoard used to carry
 * verbatim copies of all of this (ADR 0001 keeps the components
 * separate, but the input wiring is exactly the "shared surface" it
 * counts — sharing it here guarantees solo and multiplayer input
 * behavior cannot drift).
 */
export function useNumpadInteractions({
  game,
  position,
  disabled,
  assistLevel,
}: {
  game: SudokuGame;
  /** Which edge the pad sits on — the recognizer reads it as its axis. */
  position: NumPadPosition;
  disabled: boolean;
  assistLevel: AssistLevel;
}) {
  const [chargingDigit, setChargingDigit] = useState<number | null>(null);
  const highlight = useDigitHighlight(game);
  const autoEliminateNotes = assistLevel !== "paper";

  // What a digit does, and what it says it does, both come from
  // digitIntent — see src/lib/digit-intent.ts. This is the only place
  // that turns an intent into game calls, so the ordering the engine
  // requires (place before the selection moves) is stated once.
  const ops: DigitIntentOps = {
    placeNumber: (value, asNote) =>
      game.placeNumber(value, autoEliminateNotes, asNote),
    placeNoteAt: game.placeNoteAt,
    selectCell: game.selectCell,
    deselectCell: game.deselectCell,
    toggleHighlight: highlight.toggle,
    setHighlight: highlight.setDigit,
  };
  const intentFor = (gesture: DigitGesture) =>
    digitIntent(gesture, {
      board: game.board,
      selectedCell: game.selectedCell,
      selectedCells: game.selectedCells,
    });
  const runIntent = (gesture: DigitGesture, digit: number) =>
    applyDigitIntent(intentFor(gesture), digit, ops);

  const handleHoldNote = (n: number) => {
    const intent = intentFor({ kind: "hold" });
    applyDigitIntent(intent, n, ops);
    // The charge animation runs the digit into a note slot, so it only
    // plays when the hold had somewhere to pencil.
    if (intent.effect.kind !== "none") setChargingDigit(n);
  };

  // The keyboard's digit keys, which follow the N-toggled notes flag
  // rather than the selection shape. Multiplayer has no keyboard path.
  const keyDigit = (n: number) =>
    runIntent({ kind: "key", notesMode: game.notesMode }, n);

  const handlePressEnd = () => {
    setChargingDigit(null);
  };

  // A digit may only land in an empty, non-given cell. The recognizer
  // asks; the board answers.
  const isDroppable = useCallback(
    (row: number, col: number) => {
      const cell = game.board[row]?.[col];
      if (!cell) return false;
      return !cell.isGiven && cell.value === null;
    },
    [game.board],
  );

  // One recognizer owns the whole gesture — press, skim, promotion to a
  // drag, demotion back to a skim, and the drop. It lives here rather
  // than inside NumPad because the gesture does not end at the pad's
  // edge: what a landed digit DOES is still digitIntent's answer.
  const gesture = useDigitGesture({
    position,
    disabled,
    onTap: (n: number) => runIntent({ kind: "tap" }, n),
    onHold: handleHoldNote,
    onSkim: highlight.skimToDigit,
    onEnd: handlePressEnd,
    isDroppable,
    onDrop: ({ digit, mode, target, from }) =>
      runIntent({ kind: "drop", mode, target, from }, digit),
  });

  // Prop bag for <NumPad {...numPadProps} position=.../>.
  const numPadProps = {
    // The legend reads the same intent the tap will run.
    tapAction: intentFor({ kind: "tap" }).label,
    remainingCounts: game.remainingCounts,
    selectedValue: game.selectedCell
      ? game.board[game.selectedCell.row]![game.selectedCell.col]!.value
      : highlight.highlightedDigit,
    showRemainingCounts: assistLevel === "full",
    disableCompleted: assistLevel !== "paper",
    gesture: {
      keyProps: gesture.keyProps,
      groupRef: gesture.groupRef,
      pressedDigit: gesture.pressedDigit,
    },
  };

  return {
    highlight,
    chargingDigit,
    keyDigit,
    numPadProps,
    dragState: gesture.dragState,
    startCellDrag: gesture.startCellDrag,
  };
}
