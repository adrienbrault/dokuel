import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPlayerId,
  getPlayerName,
  persistPlayerName,
} from "./player-identity.ts";

describe("player identity", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("mints a name once and keeps handing back the same one", () => {
    const first = getPlayerName();
    expect(first).toMatch(/^\w+ \w+$/);
    expect(getPlayerName()).toBe(first);
  });

  it("returns a renamed player's new name", () => {
    persistPlayerName("Brave Otter");
    expect(getPlayerName()).toBe("Brave Otter");
  });

  it("keeps the same id across calls", () => {
    expect(getPlayerId()).toBe(getPlayerId());
  });

  it("still produces an identity when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(getPlayerName()).toMatch(/^\w+ \w+$/);
    expect(getPlayerId()).toBeTruthy();
    expect(() => persistPlayerName("X")).not.toThrow();
  });
});
