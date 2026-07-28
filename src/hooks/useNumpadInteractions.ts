import { useRef, useState } from "react";
import type { NumPadHandle } from "../components/NumPad.tsx";
import type { AssistLevel } from "../lib/types.ts";
import { useDigitHighlight } from "./useDigitHighlight.ts";
import { useGameDigitDrag } from "./useGameDigitDrag.ts";
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
  disabled,
  assistLevel,
}: {
  game: SudokuGame;
  disabled: boolean;
  assistLevel: AssistLevel;
}) {
  // A quick tap commits the value into the selected empty cell; on a
  // filled cell it highlights the digit instead, and a hold adds a
  // pencil note (see useDigitHighlight). With no cell selected, a tap
  // toggles the digit's board-wide highlight.
  const [chargingDigit, setChargingDigit] = useState<number | null>(null);
  const highlight = useDigitHighlight(game, assistLevel !== "paper");

  const handleHoldNote = (n: number) => {
    if (game.selectedCell || game.selectedCells.size > 0) {
      game.placeNumber(n, assistLevel !== "paper", true);
      setChargingDigit(n);
    }
  };

  const handlePressEnd = () => {
    setChargingDigit(null);
  };

  // Digit drag: top-half drop commits a value, bottom-half adds a note.
  // A drag brought back over the numpad demotes to a skim (see NumPad).
  const numPadRef = useRef<NumPadHandle>(null);
  const { dragState, startNumpadDrag, startCellDrag } = useGameDigitDrag({
    game,
    disabled,
    autoEliminateNotes: assistLevel !== "paper",
    onHighlightDigit: highlight.setDigit,
    onReturnToNumpad: (info) => numPadRef.current?.resumeSkimFromDrag(info),
  });

  // Prop bag for <NumPad {...numPadProps} ref={numPadRef} position=.../>.
  const numPadProps = {
    remainingCounts: game.remainingCounts,
    selectedValue: game.selectedCell
      ? game.board[game.selectedCell.row]![game.selectedCell.col]!.value
      : highlight.highlightedDigit,
    showRemainingCounts: assistLevel === "full",
    disableCompleted: assistLevel !== "paper",
    onTapNumber: highlight.tapDigit,
    onHoldNumber: handleHoldNote,
    onPressEnd: handlePressEnd,
    onStartDrag: startNumpadDrag,
    onSkimDigit: highlight.skimToDigit,
  };

  return {
    highlight,
    chargingDigit,
    numPadRef,
    numPadProps,
    dragState,
    startCellDrag,
  };
}
