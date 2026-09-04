import { describe, expect, it } from "vitest";
import { challengePath, parseChallenge } from "./challenge.ts";

const puzzle = "534678912672195348198342567859761423426853791713924856961537284287419635345286179".replace(/^5/, ".");

describe("friend challenges", () => {
  it("round-trips the exact puzzle and comparison conditions in a shareable path", () => {
    const challenge = { version: 1 as const, puzzle, difficulty: "easy" as const, assistLevel: "standard" as const, timeSeconds: 222, hintsUsed: 0 };
    const path = challengePath(challenge);
    expect(path).toMatch(/^\/challenge\/[A-Za-z0-9_-]+$/);
    expect(parseChallenge(path.slice("/challenge/".length))).toEqual(challenge);
  });
});
