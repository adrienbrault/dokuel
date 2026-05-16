import { demo } from "./builders.ts";
import type { Guide } from "./types.ts";

const PUZZLE = [
  "..12.456.",
  ".........",
  ".........",
  ".........",
  ".........",
  ".........",
  ".........",
  ".........",
  ".........",
].join("");

const NAKED_PAIR_DEMO = demo("np-1", "Two cells, two digits — locked together")
  .puzzle(PUZZLE)
  .restrict([0, 0], [3, 7])
  .restrict([0, 1], [3, 7])
  .step("Row 0 has two empty cells whose pencil marks are exactly {3, 7}.")
  .highlightRow(0)
  .focus([
    [0, 0],
    [0, 1],
  ])
  .step(
    "Between them, those cells must hold 3 and 7 — one each, order unknown.",
  )
  .focus([
    [0, 0],
    [0, 1],
  ])
  .step("So 3 and 7 can't appear anywhere else in this row.")
  .focus([
    [0, 0],
    [0, 1],
  ])
  .eliminate(
    [
      [0, 4],
      [0, 8],
    ],
    [3, 7],
  )
  .build();

export const NAKED_PAIRS: Guide = {
  id: "naked-pairs",
  title: "Naked Pairs",
  level: "intermediate",
  summary:
    "Two cells in a unit share the same two candidates — those digits are locked into that pair and can be removed from every other cell in the unit.",
  sections: [
    {
      heading: "Why the lock works",
      body: "If two cells in the same row, column, or box can each only hold the digits A or B, then A and B must end up in those two cells (in some order). Neither digit has anywhere else to go in that unit, so every other cell can drop A and B from its notes.",
    },
    {
      heading: "When it helps",
      body: "Naked Pairs rarely solve a cell on their own, but the candidate eliminations they create often open up Hidden or Naked Singles that would otherwise stay invisible.",
    },
  ],
  demos: [NAKED_PAIR_DEMO],
};
