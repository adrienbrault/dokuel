import { afterEach, describe, expect, it } from "vitest";
import { getPlayerId, getPlayerName, setPlayerName } from "./player.ts";

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("getPlayerName", () => {
  it("returns the stored name when present", () => {
    localStorage.setItem("sudoku_player_name", "clever-otter");
    expect(getPlayerName()).toBe("clever-otter");
  });

  it("generates and persists a name on first use", () => {
    expect(localStorage.getItem("sudoku_player_name")).toBeNull();
    const name = getPlayerName();
    expect(name).toBeTruthy();
    expect(localStorage.getItem("sudoku_player_name")).toBe(name);
  });

  it("recovers a name from sessionStorage before minting a new one", () => {
    sessionStorage.setItem("sudoku_player_name", "fast-fox");
    expect(getPlayerName()).toBe("fast-fox");
    expect(localStorage.getItem("sudoku_player_name")).toBe("fast-fox");
  });
});

describe("getPlayerId", () => {
  it("generates a stable id that persists across calls", () => {
    const id = getPlayerId();
    expect(id).toBeTruthy();
    expect(getPlayerId()).toBe(id);
  });
});

describe("setPlayerName", () => {
  it("overwrites the stored name", () => {
    setPlayerName("renamed");
    expect(getPlayerName()).toBe("renamed");
  });
});
