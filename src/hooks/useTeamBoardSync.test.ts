import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TeamCells } from "./p2p-room.ts";
import { useSudoku } from "./useSudoku.ts";
import { useTeamBoardSync } from "./useTeamBoardSync.ts";

const SOLVED =
  "534678912" +
  "672195348" +
  "198342567" +
  "859761423" +
  "426853791" +
  "713924856" +
  "961537284" +
  "287419635" +
  "345286179";
// Three holes: indices 0, 1 and 2 (5, 3 and 4).
const PUZZLE = `...${SOLVED.slice(3)}`;

const blank = (): TeamCells => Array(81).fill(null);

function setup() {
  const setCell = vi.fn();
  const hook = renderHook(
    ({ teamCells }: { teamCells: TeamCells | null }) => {
      const game = useSudoku(PUZZLE, SOLVED);
      useTeamBoardSync({ game, teamCells, setCell });
      return game;
    },
    { initialProps: { teamCells: blank() as TeamCells | null } },
  );
  return { ...hook, setCell };
}

describe("useTeamBoardSync", () => {
  it("sends our own placement to the team's board", () => {
    const { result, setCell } = setup();

    act(() => result.current.selectCell(0, 1));
    act(() => result.current.placeNumber(3));

    expect(setCell).toHaveBeenCalledWith(1, 3);
  });
});
