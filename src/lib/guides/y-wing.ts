import { demo } from "./builders.ts";
import { challenge } from "./challenge-builder.ts";
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
  challenges: [
    challenge(
      "yw-c1",
      "Tap the three bi-value cells that form the Y-Wing (pivot + two wings).",
    )
      .puzzle(PUZZLE)
      .restrict([0, 0], [1, 2])
      .restrict([0, 5], [1, 3])
      .restrict([5, 0], [2, 3])
      .restrict([5, 5], [3, 9])
      .selectCells([
        [0, 0],
        [0, 5],
        [5, 0],
      ])
      .explain(
        "(0,0) is the pivot {1,2}. (0,5) shares row 0 and carries {1,3}. (5,0) shares column 0 and carries {2,3}. Whichever digit the pivot takes, one of the wings is forced to 3.",
      )
      .build(),
    challenge(
      "yw-c2",
      "Tap the three bi-value cells that form the Y-Wing (pivot + two wings).",
    )
      .puzzle(PUZZLE)
      .restrict([4, 4], [5, 8])
      .restrict([4, 7], [5, 6])
      .restrict([7, 4], [8, 6])
      .selectCells([
        [4, 4],
        [4, 7],
        [7, 4],
      ])
      .explain(
        "Pivot at (4,4) carries {5,8}. Row wing (4,7) shares row 4 with the pivot and holds {5,6}. Column wing (7,4) shares column 4 and holds {8,6}. Either way the pivot resolves, one wing is forced to 6.",
      )
      .build(),
    challenge(
      "yw-c3",
      "Tap the three bi-value cells that form the Y-Wing (pivot + two wings).",
    )
      .puzzle(PUZZLE)
      .restrict([2, 2], [4, 7])
      .restrict([2, 8], [4, 9])
      .restrict([8, 2], [7, 9])
      .selectCells([
        [2, 2],
        [2, 8],
        [8, 2],
      ])
      .explain(
        "Pivot {4,7} sits at (2,2). Row wing (2,8) shares row 2 and holds {4,9}; column wing (8,2) shares column 2 and holds {7,9}. The shared third digit is 9 — any cell that sees both wings can drop 9 from its notes.",
      )
      .build(),
  ],
};
