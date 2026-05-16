import { demo } from "./builders.ts";
import type { Guide } from "./types.ts";

const PUZZLE = ".".repeat(81);

const Y_WING_DEMO = demo("yw-1", "Pivot + two wings force out a third digit")
  .puzzle(PUZZLE)
  .restrict([0, 0], [1, 2])
  .restrict([0, 5], [1, 3])
  .restrict([5, 0], [2, 3])
  .restrict([5, 5], [3, 9])
  .step(
    "Three bi-value cells: a pivot with {1, 2} and two wings — one {1, 3} sharing row 0, one {2, 3} sharing column 0.",
  )
  .focus([
    [0, 0],
    [0, 5],
    [5, 0],
  ])
  .step(
    "Pretend the pivot is 1. Then the row-0 wing can't be 1, so it must be 3.",
  )
  .focus([
    [0, 0],
    [0, 5],
  ])
  .step(
    "Pretend the pivot is 2 instead. Then the column-0 wing can't be 2, so it must be 3.",
  )
  .focus([
    [0, 0],
    [5, 0],
  ])
  .step(
    "Either way, one of the wings is 3 — so any cell that sees both wings can't be 3.",
  )
  .focus([
    [0, 5],
    [5, 0],
  ])
  .highlightRow(5)
  .highlightCol(5)
  .eliminate([[5, 5]], [3])
  .build();

export const Y_WING: Guide = {
  id: "y-wing",
  title: "Y-Wing",
  level: "advanced",
  summary:
    "Three bi-value cells form a chain. Whichever value the pivot takes, one of the wings is forced to the shared third digit — eliminating it from any cell that sees both wings.",
  sections: [
    {
      heading: "The shape",
      body: "Look for a pivot cell with candidates {X, Y} and two wing cells, each sharing a unit with the pivot: one wing has {X, Z}, the other has {Y, Z}. The wings don't need to see each other — only the pivot.",
    },
    {
      heading: "The logic",
      body: "If the pivot ends up as X, the X-Z wing must be Z. If the pivot ends up as Y, the Y-Z wing must be Z. So one of the wings is always Z — and any cell that lies in a unit with both wings can't be Z.",
    },
    {
      heading: "Why it's worth the hunt",
      body: "Y-Wings open up positions where the usual eliminations have stalled. They're easier to spot once you start filtering for bi-value cells — many puzzles only have a handful, so the candidate triangles jump out quickly.",
    },
  ],
  demos: [Y_WING_DEMO],
};
