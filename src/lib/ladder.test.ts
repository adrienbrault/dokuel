// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { EliminationKind } from "./candidates.ts";
import { LADDER } from "./ladder.ts";

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
});
