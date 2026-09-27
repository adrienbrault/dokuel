import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The module caches the preference, so each test loads a fresh copy.
async function load() {
  vi.resetModules();
  return import("./ambiance-settings.ts");
}

describe("ambiance settings", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("is on until the player turns it off, and remembers the choice", async () => {
    const first = await load();
    expect(first.getAmbianceEnabled()).toBe(true);

    first.setAmbianceEnabled(false);

    const reloaded = await load();
    expect(reloaded.getAmbianceEnabled()).toBe(false);
  });

  it("tells subscribers when the preference changes", async () => {
    const settings = await load();
    const listener = vi.fn();
    const unsubscribe = settings.subscribeAmbianceEnabled(listener);

    settings.setAmbianceEnabled(false);
    unsubscribe();
    settings.setAmbianceEnabled(true);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("still toggles for the session when storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const settings = await load();

    expect(settings.getAmbianceEnabled()).toBe(true);
    settings.setAmbianceEnabled(false);
    expect(settings.getAmbianceEnabled()).toBe(false);
  });
});
