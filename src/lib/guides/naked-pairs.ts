import { demo } from "./builders.ts";
import { challenge } from "./challenge-builder.ts";
import type { Guide } from "./types.ts";

const EMPTY_PUZZLE = ".".repeat(81);

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
  challenges: [
    challenge("np-c1", "Tap the two cells that form the Naked Pair in row 0.")
      .puzzle(EMPTY_PUZZLE)
      .restrict([0, 2], [3, 7])
      .restrict([0, 5], [3, 7])
      .selectCells([
        [0, 2],
        [0, 5],
      ])
      .explain(
        "Both highlighted cells carry exactly {3, 7} — between them they must take 3 and 7, locking those digits out of every other cell in row 0.",
      )
      .build(),
    challenge(
      "np-c2",
      "Tap the two cells that form the Naked Pair in column 3.",
    )
      .puzzle(EMPTY_PUZZLE)
      .restrict([1, 3], [2, 5])
      .restrict([6, 3], [2, 5])
      .selectCells([
        [1, 3],
        [6, 3],
      ])
      .explain(
        "Both cells in column 3 hold exactly {2, 5}. One must be 2 and the other 5 — neither digit can appear anywhere else in this column.",
      )
      .build(),
    challenge(
      "np-c3",
      "Tap the two cells that form the Naked Pair in the center box.",
    )
      .puzzle(EMPTY_PUZZLE)
      .restrict([3, 4], [4, 9])
      .restrict([5, 4], [4, 9])
      .selectCells([
        [3, 4],
        [5, 4],
      ])
      .explain(
        "Both cells share exactly {4, 9}. Inside the center box, 4 and 9 are locked into these two cells — every other cell in the box can strip both digits from its notes.",
      )
      .build(),
  ],
};
