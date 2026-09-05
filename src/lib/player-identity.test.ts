import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPlayerId,
  getPlayerName,
  setPlayerName,
} from "./player-identity.ts";

describe("player identity", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("generates a name on first read and reuses it afterwards", () => {
    const name = getPlayerName();
    expect(name).toMatch(/^\S+ \S+$/);
    expect(getPlayerName()).toBe(name);
  });

  it("generates an id on first read and reuses it afterwards", () => {
    const id = getPlayerId();
    expect(id).not.toBe("");
    expect(getPlayerId()).toBe(id);
  });

  it("remembers a renamed player", () => {
    getPlayerName();
    setPlayerName("Brave Otter");
    expect(getPlayerName()).toBe("Brave Otter");
  });

  it("still yields a name when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(getPlayerName()).toMatch(/^\S+ \S+$/);
    expect(getPlayerId()).not.toBe("");
  });
});
