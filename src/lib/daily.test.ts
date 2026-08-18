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
  // every future daily is the intended outcome. Last regenerated when
  // medium gained its technique-grade cap (tier ≤ 2).
  it("matches the pinned golden vectors", () => {
    const jan = getDailyPuzzle("2026-01-01", "medium");
    expect(jan.puzzle).toBe(
      "...231..8..........8.4..531..7.5....6...243..8.49..7...1389..6.2..3761.9.....2.7.",
    );
    expect(jan.solution).toBe(
      "475231698136589247982467531327658914691724385854913726713895462248376159569142873",
    );
    const jul = getDailyPuzzle("2026-07-27", "medium");
    expect(jul.puzzle).toBe(
      "7.86....9.9..7.6.1.2.15.....4......7..73...822.37..5.48..236...1.....2.6..2.15..8",
    );
    expect(jul.solution).toBe(
      "718623459395478621426159873941582367567394182283761594874236915159847236632915748",
    );
  });
});
