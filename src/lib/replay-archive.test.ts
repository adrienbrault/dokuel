import { beforeEach, describe, expect, it } from "vitest";
import {
  type ArchivedReplay,
  getArchivedReplay,
  MAX_ARCHIVED_REPLAYS,
  saveArchivedReplay,
} from "./replay-archive.ts";

function replay(roomId: string, gameNumber = 1): ArchivedReplay {
  return {
    roomId,
    gameNumber,
    puzzle: `...${"1".repeat(78)}`,
    solution: "2".repeat(81),
    me: { name: "You", color: "#3B82F6", won: true, frames: [[0, 0, 2]] },
    opponent: {
      name: "Bob",
      color: "#EF4444",
      won: false,
      frames: [[500, 1, 2]],
    },
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("replay archive", () => {
  it("finds a saved match by room and game number", () => {
    saveArchivedReplay(replay("room-a", 2));

    expect(getArchivedReplay("room-a", 2)).toEqual(replay("room-a", 2));
    expect(getArchivedReplay("room-a", 1)).toBeNull();
  });

  it("updates a match in place as the opponent's moves arrive", () => {
    saveArchivedReplay({ ...replay("room-a"), opponent: null });
    saveArchivedReplay(replay("room-a"));

    expect(getArchivedReplay("room-a", 1)?.opponent?.name).toBe("Bob");
  });

  it("keeps only the most recent matches", () => {
    for (let i = 0; i <= MAX_ARCHIVED_REPLAYS; i++) {
      saveArchivedReplay(replay(`room-${i}`));
    }

    expect(getArchivedReplay("room-0", 1)).toBeNull();
    expect(getArchivedReplay(`room-${MAX_ARCHIVED_REPLAYS}`, 1)).not.toBeNull();
  });

  it("ignores a stored match whose moves are corrupt", () => {
    localStorage.setItem(
      "sudoku_mp_replays",
      JSON.stringify([
        {
          ...replay("room-a"),
          me: { name: "You", color: "#000", won: true, frames: "garbage" },
        },
      ]),
    );

    expect(getArchivedReplay("room-a", 1)).toBeNull();
  });
});
