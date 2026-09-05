import { beforeEach, describe, expect, it } from "vitest";
import {
  getLastMultiplayerDifficulty,
  setLastMultiplayerDifficulty,
} from "./mp-preferences.ts";

describe("last multiplayer difficulty", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to medium for a player who never hosted a room", () => {
    expect(getLastMultiplayerDifficulty()).toBe("medium");
  });

  it("remembers the difficulty the player last raced on", () => {
    setLastMultiplayerDifficulty("expert");

    expect(getLastMultiplayerDifficulty()).toBe("expert");
  });

  it("falls back to medium when the stored value is not a difficulty", () => {
    // The create flow now trusts this value with no picker behind it,
    // so a hand-edited or stale key must not seed a room with junk.
    localStorage.setItem("sudoku_mp_difficulty", JSON.stringify("impossible"));

    expect(getLastMultiplayerDifficulty()).toBe("medium");
  });
});
