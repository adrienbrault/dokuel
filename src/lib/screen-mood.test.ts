// @vitest-environment node
import { describe, expect, it } from "vitest";
import { moodForScreen } from "./screen-mood.ts";

describe("moodForScreen", () => {
  it("returns game for every screen where a board is in play", () => {
    for (const name of ["solo", "daily", "multiplayer"] as const) {
      expect(moodForScreen(name)).toBe("game");
    }
  });

  it("returns menu for navigation and meta screens", () => {
    for (const name of [
      "landing",
      "difficulty",
      "join",
      "stats",
      "notFound",
    ] as const) {
      expect(moodForScreen(name)).toBe("menu");
    }
  });
});