// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { getLastDifficulty, setLastDifficulty } from "./last-difficulty.ts";

describe("last-difficulty", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns medium by default", () => {
    expect(getLastDifficulty()).toBe("medium");
  });

  it("returns stored difficulty after set", () => {
    setLastDifficulty("hard");
    expect(getLastDifficulty()).toBe("hard");
  });

  it("returns medium for invalid stored value", () => {
    localStorage.setItem("sudoku_last_difficulty", "invalid");
    expect(getLastDifficulty()).toBe("medium");
  });
});
