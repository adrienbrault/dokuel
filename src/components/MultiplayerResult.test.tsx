import { describe, expect, it, vi } from "vitest";
import type { Player } from "../lib/types.ts";
import { replayPlayers } from "./MultiplayerResult.tsx";

function player(id: string, completionPercent: number): Player {
  return {
    id,
    name: id,
    color: "#000000",
    cellsRemaining: 0,
    completionPercent,
    team: null,
  };
}

const players = [
  player("me", 60),
  player("bob", 30),
  player("carol", 100),
  player("dan", 80),
];

describe("replayPlayers", () => {
  it("sets us against the winner in a bigger room", () => {
    const [mine, theirs] = replayPlayers(
      { players, replays: {}, share: vi.fn() },
      "me",
      "",
      { winnerId: "carol" },
    );

    expect(mine.id).toBe("me");
    expect(theirs).toMatchObject({ id: "carol", won: true });
  });

  it("sets us against the closest finisher when we won", () => {
    const [, theirs] = replayPlayers(
      { players, replays: {}, share: vi.fn() },
      "carol",
      "",
      { winnerId: "carol" },
    );

    expect(theirs).toMatchObject({ id: "dan", won: false });
  });
});
