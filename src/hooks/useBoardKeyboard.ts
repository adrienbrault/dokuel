import { useKeyboard } from "./useKeyboard.ts";
import type { useSudoku } from "./useSudoku.ts";

type Game = ReturnType<typeof useSudoku>;

type UseBoardKeyboardOptions = {
  game: Game;
  /** False in "paper" assist, where placing a digit must not touch notes. */
  autoEliminateNotes: boolean;
  /** Off while paused or once the board is finished. */
  enabled: boolean;
};

/**
 * Wires physical-keyboard play into a sudoku board: digits place, arrows
 * move the selection, Backspace erases, N toggles notes, Cmd/Ctrl+Z undoes.
 *
 * Shared by solo and multiplayer so the two cannot drift — the settings
 * popover advertises one set of shortcuts to both.
 */
export function useBoardKeyboard({
  game,
  autoEliminateNotes,
  enabled,
}: UseBoardKeyboardOptions) {
  useKeyboard({
    selectedCell: game.selectedCell,
    onSelectCell: game.selectCell,
    onDeselectCell: game.deselectCell,
    // A digit follows the current notesMode flag rather than taking a
    // separate binding, preserving the established "press N then 1"
    // pencil-mark workflow. Committing a note also drops the selection,
    // so the next digit does not silently land in the same cell.
    onPlaceNumber: (n) => {
      if (!game.selectedCell && game.selectedCells.size === 0) return;
      const wasNoteMode = game.notesMode;
      game.placeNumber(n, autoEliminateNotes);
      if (wasNoteMode) game.deselectCell();
    },
    onErase: game.erase,
    onUndo: game.undo,
    onToggleNotes: game.toggleNotesMode,
    enabled,
  });
}
