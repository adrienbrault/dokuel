import { useMemo, useRef, useState } from "react";
import type { NumPadHandle } from "../components/NumPad.tsx";
import { cellKey } from "../lib/sudoku.ts";
import type { AssistLevel } from "../lib/types.ts";
import { useDigitHighlight } from "./useDigitHighlight.ts";
import { useGameDigitDrag } from "./useGameDigitDrag.ts";
import { useKeyboard } from "./useKeyboard.ts";

type SudokuGame = ReturnType<typeof import("./useSudoku.ts").useSudoku>;

/**
 * Bundles SoloGame's board-input wiring — keyboard, numpad tap/hold,
 * digit drag, and the active-hint highlight — into one hook. SoloGame
 * stays focused on layout and game lifecycle; the input plumbing,
 * which is intricate but self-contained, lives here.
 */
export function useSoloGameInput(
  game: SudokuGame,
  assistLevel: AssistLevel,
  paused: boolean,
) {
  // Keyboard digit follows the current notesMode flag (N toggles it),
  // preserving the established "press N then 1" pencil-mark workflow.
  const handleKeyboardNumber = (n: number) => {
    if (game.selectedCell || game.selectedCells.size > 0) {
      const wasNoteMode = game.notesMode;
      game.placeNumber(n, assistLevel !== "paper");
      if (wasNoteMode) game.deselectCell();
    }
  };

  // Touch numpad: a quick tap commits the value, a hold adds a pencil
  // note. The selected cell stays selected through either action. With
  // no cell selected, a tap toggles the digit's board-wide highlight.
  const [chargingDigit, setChargingDigit] = useState<number | null>(null);
  const highlight = useDigitHighlight(game);
  const onTapNumber = (n: number) => {
    if (game.selectedCell || game.selectedCells.size > 0) {
      game.placeNumber(n, assistLevel !== "paper", false);
    } else {
      highlight.toggle(n);
    }
  };
  const onHoldNumber = (n: number) => {
    if (game.selectedCell || game.selectedCells.size > 0) {
      game.placeNumber(n, assistLevel !== "paper", true);
      setChargingDigit(n);
    }
  };
  const onPressEnd = () => {
    setChargingDigit(null);
  };

  // Digit drag: top-half drop commits a value, bottom-half adds a note.
  // A drag brought back over the numpad demotes to a skim (see NumPad).
  const numPadRef = useRef<NumPadHandle>(null);
  const { dragState, startNumpadDrag, startCellDrag } = useGameDigitDrag({
    game,
    disabled: paused || game.status !== "playing",
    autoEliminateNotes: assistLevel !== "paper",
    onHighlightDigit: highlight.setDigit,
    onReturnToNumpad: (info) => numPadRef.current?.resumeSkimFromDrag(info),
  });

  useKeyboard({
    selectedCell: game.selectedCell,
    onSelectCell: game.selectCell,
    onDeselectCell: game.deselectCell,
    onPlaceNumber: handleKeyboardNumber,
    onErase: game.erase,
    onUndo: game.undo,
    onToggleNotes: game.toggleNotesMode,
    enabled: game.status === "playing" && !paused,
  });

  const hintCells = useMemo(() => {
    if (!game.activeHint) return undefined;
    const set = new Set<number>();
    for (const pos of game.activeHint.relatedCells) {
      set.add(cellKey(pos.row, pos.col));
    }
    return set;
  }, [game.activeHint]);

  return {
    highlight,
    chargingDigit,
    numPadRef,
    dragState,
    startNumpadDrag,
    startCellDrag,
    hintCells,
    onTapNumber,
    onHoldNumber,
    onPressEnd,
  };
}
