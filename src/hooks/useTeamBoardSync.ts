import { useEffect, useRef } from "react";
import type { Board, TeamCells } from "../lib/types.ts";

type Game = {
  board: Board;
  applyRemote: (cells: { index: number; value: number | null }[]) => void;
};

type Options = {
  game: Game;
  /** Our team's shared board, or null outside a teams game. */
  teamCells: TeamCells | null;
  setCell: (index: number, value: number | null) => void;
};

/**
 * Binds the local board to the team's shared one. Outbound, only cells
 * our own action just changed are sent: diffing against the shared
 * board instead would send back a teammate's digit that arrived in the
 * same render but has not reached our reducer yet, undoing their move.
 */
export function useTeamBoardSync({ game, teamCells, setCell }: Options) {
  const { board } = game;
  const lastBoard = useRef(board);

  useEffect(() => {
    const previous = lastBoard.current;
    lastBoard.current = board;
    if (!teamCells || previous === board) return;
    board.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell.isGiven || cell.value === previous[r]![c]!.value) return;
        setCell(r * 9 + c, cell.value);
      });
    });
  }, [board, teamCells, setCell]);
}
