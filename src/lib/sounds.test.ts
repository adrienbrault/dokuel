import { afterEach, describe, expect, it, vi } from "vitest";

// getSoundEnabled is called on EVERY placement/erase/note via
// game-feedback, so a throwing localStorage (Safari/Chrome with "block
// all cookies", private modes) must not crash input handling — that
// configuration previously made the game unplayable.
describe("sounds storage guards", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("defaults to enabled when localStorage.getItem throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const { getSoundEnabled } = await import("./sounds.ts");
    expect(getSoundEnabled()).toBe(true);
  });

  it("keeps the preference in memory when localStorage.setItem throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const { getSoundEnabled, setSoundEnabled } = await import("./sounds.ts");
    expect(() => setSoundEnabled(false)).not.toThrow();
    expect(getSoundEnabled()).toBe(false);
  });
});
