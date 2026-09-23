import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { getArchivedReplay } from "../lib/replay-archive.ts";
import type { Player } from "../lib/types.ts";
import { useArchiveMatchReplay } from "./useArchiveMatchReplay.ts";

const PUZZLE = `...${"1".repeat(78)}`;
const players: Player[] = [
  {
    id: "p1",
    name: "Alice",
    color: "#3B82F6",
    cellsRemaining: 0,
    completionPercent: 100,
  },
  {
    id: "p2",
    name: "Bob",
    color: "#EF4444",
    cellsRemaining: 2,
    completionPercent: 33,
  },
];

type Props = Parameters<typeof useArchiveMatchReplay>[0];

function props(overrides: Partial<Props> = {}): Props {
  return {
    roomId: "room-a",
    playerId: "p1",
    gameNumber: 3,
    puzzle: PUZZLE,
    solution: null,
    players,
    replays: {},
    gameOver: null,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("useArchiveMatchReplay", () => {
  it("archives nothing while the game is on", () => {
    renderHook(() =>
      useArchiveMatchReplay(props({ replays: { p1: [[0, 0, 2]] } })),
    );

    expect(getArchivedReplay("room-a", 3)).toBeNull();
  });

  it("archives the match once over, and again as the opponent's moves land", () => {
    const gameOver = { winnerId: "p1", winnerName: "Alice" };
    const { rerender } = renderHook((p: Props) => useArchiveMatchReplay(p), {
      initialProps: props({ gameOver, replays: { p1: [[0, 0, 2]] } }),
    });

    expect(getArchivedReplay("room-a", 3)).toMatchObject({
      me: { name: "You", won: true, frames: [[0, 0, 2]] },
      opponent: null,
    });

    rerender(
      props({ gameOver, replays: { p1: [[0, 0, 2]], p2: [[900, 1, 2]] } }),
    );

    expect(getArchivedReplay("room-a", 3)?.opponent).toEqual({
      name: "Bob",
      color: "#EF4444",
      won: false,
      frames: [[900, 1, 2]],
    });
  });
});
