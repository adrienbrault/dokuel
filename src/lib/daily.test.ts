// @vitest-environment node
import { describe, expect, it } from "vitest";
import dailies from "./dailies.json";
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

describe("the frozen daily table", () => {
  const table = dailies as Record<string, string>;
  const dates = Object.keys(table);

  it("covers every date from 2026-05-01 through 2027-12-31", () => {
    expect(dates[0]).toBe("2026-05-01");
    expect(dates[dates.length - 1]).toBe("2027-12-31");
    expect(dates).toHaveLength(610);
  });

  it("preserves the puzzle the generator produces for the golden date", () => {
    // The point of the table is that it can never fork from what
    // players already saw: a mismatch here means the generator drifted
    // and the table was not regenerated with it.
    expect(table["2026-07-27"]).toBe(getDailyPuzzle("2026-07-27").puzzle);
  });

  it("stores solvable 81-cell boards", () => {
    // Every entry costs a full solve, so a spread sample stands in for
    // the whole table rather than making the suite grind.
    for (let i = 0; i < dates.length; i += 61) {
      const date = dates[i] as string;
      const puzzle = table[date] as string;
      expect(puzzle).toMatch(/^[.1-9]{81}$/);
      expect(countSolutions(puzzle)).toBe(1);
    }
  });
});
