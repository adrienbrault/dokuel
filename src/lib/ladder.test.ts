// @vitest-environment node
import { describe, expect, it } from "vitest";
import { type EliminationKind, initCandidates } from "./candidates.ts";
import { LADDER } from "./ladder.ts";

// Two boards captured mid-solve, singles played to exhaustion — the
// state a stuck player faces. Between them every rung's pattern is on
// the board, so the pair proves each scan finds what its rung claims.
const STUCK_BOARDS = [
  "5.....3277.982.4656..57.891.7....1.49.31.5.78..1..7..9497.1.5823..4927161..758943",
  "6.4..8..72..59184689...63.....8.267...8.57..972.9..518.82..5...5........1....97.5",
];

// Enumerated as a total record so the type-checker forces this test to
// grow the day a new elimination kind joins the union.
const EVERY_KIND: Record<EliminationKind, true> = {
  pointing: true,
  claiming: true,
  "naked-pair": true,
  "hidden-pair": true,
  "naked-triple": true,
  "hidden-triple": true,
  "naked-quad": true,
  "hidden-quad": true,
  "x-wing": true,
  "xy-wing": true,
  swordfish: true,
};

describe("LADDER", () => {
  it("names every elimination kind exactly once", () => {
    const kinds = LADDER.map((rung) => rung.kind);

    expect([...kinds].sort((a, b) => a.localeCompare(b))).toEqual(
      Object.keys(EVERY_KIND).sort((a, b) => a.localeCompare(b)),
    );
  });

  it("orders the rungs cheapest first", () => {
    // The grader reports the hardest tier a puzzle demanded and the
    // hint cites the cheapest technique that works — both read this
    // order, so a rung out of place changes grades and hints at once.
    const tiers = LADDER.map((rung) => rung.tier);

    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
  });

  it("gives every rung a scan that finds the rung's own kind", () => {
    // The wiring the six hand-synced copies used to get wrong in
    // silence: a rung labelled "naked triple" whose scan looks for
    // quads grades and explains every board that reaches it wrongly.
    const found = new Set<EliminationKind>();

    for (const puzzle of STUCK_BOARDS) {
      for (const rung of LADDER) {
        const elimination = rung.scan(initCandidates(puzzle)!);
        if (!elimination) continue;
        expect(elimination.kind).toBe(rung.kind);
        found.add(rung.kind);
      }
    }

    expect([...found].sort((a, b) => a.localeCompare(b))).toEqual(
      Object.keys(EVERY_KIND).sort((a, b) => a.localeCompare(b)),
    );
  });
});
