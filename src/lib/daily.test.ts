import { describe, expect, it } from "vitest";
import { getDailyPuzzle } from "./daily.ts";

describe("getDailyPuzzle", () => {
  it("returns same puzzle for same date", () => {
    const a = getDailyPuzzle("2026-03-07", "medium");
    const b = getDailyPuzzle("2026-03-07", "medium");
    expect(a.puzzle).toBe(b.puzzle);
    expect(a.solution).toBe(b.solution);
  });

  it("returns different puzzle for different dates", () => {
    const a = getDailyPuzzle("2026-03-07", "medium");
    const b = getDailyPuzzle("2026-03-08", "medium");
    expect(a.puzzle).not.toBe(b.puzzle);
  });

  it("returns valid puzzle and solution", () => {
    const { puzzle, solution } = getDailyPuzzle("2026-03-07", "easy");
    expect(puzzle).toMatch(/^[.1-9]{81}$/);
    expect(solution).toMatch(/^[1-9]{81}$/);
  });
});
