import { useEffect, useRef } from "react";
import type { Board, Credit, TeamCells } from "../lib/types.ts";

type Game = {
  board: Board;
  applyRemote: (cells: { index: number; value: number | null }[]) => void;
};

/** What a teams game adds to a player's board. */
export type TeamPlay = {
  /** Our team's shared board; null until the room has one. */
  cells: TeamCells | null;
  setCell: (index: number, value: number | null) => void;
  /** Our teammates' ids: their win is ours. */
  allies: string[];
  /** The whole room is one team: no rivals, no winner. */
  coop?: boolean | undefined;
  /** Who placed what on the shared board, us first. */
  credits?: Credit[] | undefined;
};

/**
 * Binds the local board to the team's shared one. Outbound, only cells
 * our own action just changed are sent: diffing against the shared
 * board instead would send back a teammate's digit that arrived in the
 * same render but has not reached our reducer yet, undoing their move.
 */
export function useTeamBoardSync(game: Game, team: TeamPlay | undefined) {
  const { board, applyRemote } = game;
  const teamCells = team?.cells ?? null;
  const setCell = team?.setCell;
  const lastBoard = useRef(board);
  const lastTeamCells = useRef<TeamCells | null>(null);

  // Inbound: what changed on the shared board since we last looked.
  // The first look takes the shared board whole; it is the truth our
  // locally restored copy may have fallen behind.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new shared board runs this; the board is read for the first look alone
  useEffect(() => {
    if (!teamCells) return;
    const previous = lastTeamCells.current;
    lastTeamCells.current = teamCells;
    const cells: { index: number; value: number | null }[] = [];
    teamCells.forEach((value, index) => {
      const known = previous
        ? previous[index]
        : board[Math.floor(index / 9)]![index % 9]!.value;
      if (value !== known) cells.push({ index, value });
    });
    if (cells.length > 0) applyRemote(cells);
  }, [teamCells, applyRemote]);

  // Outbound: cells our own action changed, minus those that merely
  // caught up with the shared board.
  useEffect(() => {
    const previous = lastBoard.current;
    lastBoard.current = board;
    const shared = lastTeamCells.current;
    if (!shared || !setCell || previous === board) return;
    board.forEach((row, r) => {
      row.forEach((cell, c) => {
        const index = r * 9 + c;
        if (cell.isGiven || cell.value === previous[r]![c]!.value) return;
        if (cell.value === shared[index]) return;
        setCell(index, cell.value);
      });
    });
  }, [board, setCell]);
}
