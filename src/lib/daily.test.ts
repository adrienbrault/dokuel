// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getDailyPuzzle } from "./daily.ts";
import { todayLocalISO } from "./date.ts";
import { countSolutions } from "./solver.ts";

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
    expect(countSolutions(puzzle)).toBe(1);
  });

  it("defaults to the local calendar date, not the UTC date", () => {
    expect(getDailyPuzzle().date).toBe(todayLocalISO());
  });

  // Golden vectors: "same puzzle for everyone" only holds across app
  // versions if these exact strings never change. Any edit to the
  // generator, clue bands, seeding, or rng silently forks the daily
  // between differently-cached bundles — if one of these fails, that
  // is what just happened. Regenerate the vectors only when forking
  // every future daily is the intended outcome.
  it("matches the pinned golden vectors", () => {
    const jan = getDailyPuzzle("2026-01-01", "medium");
    expect(jan.puzzle).toBe(
      "1...6.73.....7.....7.5..6293.9..51......3.29.6.79.1.4.93.8...7.7..1....3864.57.1.",
    );
    expect(jan.solution).toBe(
      "185269734296473851473518629349725168518634297627981345931842576752196483864357912",
    );
    const jul = getDailyPuzzle("2026-07-27", "medium");
    expect(jul.puzzle).toBe(
      "71....6...46....799...3.2...3.2.5..68.......4569.....3.7..86...2..1..4.7.5..7.3..",
    );
    expect(jul.solution).toBe(
      "712894635346521879985637241437215986821369754569748123173486592298153467654972318",
    );
  });
});
