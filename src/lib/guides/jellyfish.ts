import { demo } from "./builders.ts";
import { challenge } from "./challenge-builder.ts";
import type { Guide } from "./types.ts";

const PUZZLE = ".".repeat(81);

const FISH_CELLS: [number, number][] = [
  [0, 1],
  [0, 3],
  [0, 5],
  [0, 7],
  [2, 1],
  [2, 3],
  [2, 5],
  [2, 7],
  [5, 1],
  [5, 3],
  [5, 5],
  [5, 7],
  [7, 1],
  [7, 3],
  [7, 5],
  [7, 7],
];

const JELLYFISH_DEMO = demo("jf-1", "Four rows × four columns of 2s")
  .puzzle(PUZZLE)
  .restrict([0, 1], [2, 4])
  .restrict([0, 3], [2, 5])
  .restrict([0, 5], [2, 6])
  .restrict([0, 7], [2, 8])
  .restrict([2, 1], [2, 9])
  .restrict([2, 3], [2, 3])
  .restrict([2, 5], [2, 4])
  .restrict([2, 7], [2, 7])
  .restrict([5, 1], [2, 6])
  .restrict([5, 3], [2, 8])
  .restrict([5, 5], [2, 9])
  .restrict([5, 7], [2, 4])
  .restrict([7, 1], [2, 3])
  .restrict([7, 3], [2, 6])
  .restrict([7, 5], [2, 5])
  .restrict([7, 7], [2, 8])
  .restrict([3, 1], [2, 7])
  .restrict([6, 5], [2, 9])
  .step("In rows 0, 2, 5, and 7, the digit 2 fits only in columns 1, 3, 5, 7.")
  .highlightRow(0)
  .highlightRow(2)
  .highlightRow(5)
  .highlightRow(7)
  .focus(FISH_CELLS)
  .step("Sixteen cells. The 2s spread across — one per row, one per column.")
  .focus(FISH_CELLS)
  .step("So 2 can't appear elsewhere in columns 1, 3, 5, or 7.")
  .eliminate(
    [
      [3, 1],
      [6, 5],
    ],
    [2],
  )
  .build();

export const JELLYFISH: Guide = {
  id: "jellyfish",
  title: "Jellyfish",
  level: "advanced",
  summary:
    "Four rows where a digit's candidates all live inside the same four columns. The digit is locked into the 4×4 grid — eliminate it from the rest of those columns.",
  sections: [
    {
      heading: "The shape",
      body: "Pick a digit. If in four different rows, the digit's candidate cells all live inside the same four columns, you have a Jellyfish. The digit must take one cell per row and one cell per column — exactly four placements across the 4×4 grid.",
    },
    {
      heading: "Why it's worth checking last",
      body: "Jellyfish are rarer than Swordfish and Swordfish are rarer than X-Wing — the search cost grows. Reach for Jellyfish only after the simpler fishes have failed; on most puzzles you'll never need one.",
    },
  ],
  demos: [JELLYFISH_DEMO],
  challenges: [
    challenge(
      "jf-c1",
      "Tap the sixteen cells that form the Jellyfish on the digit 2.",
    )
      .puzzle(PUZZLE)
      .restrict([0, 1], [2, 4])
      .restrict([0, 3], [2, 5])
      .restrict([0, 5], [2, 6])
      .restrict([0, 7], [2, 8])
      .restrict([2, 1], [2, 9])
      .restrict([2, 3], [2, 3])
      .restrict([2, 5], [2, 4])
      .restrict([2, 7], [2, 7])
      .restrict([5, 1], [2, 6])
      .restrict([5, 3], [2, 8])
      .restrict([5, 5], [2, 9])
      .restrict([5, 7], [2, 4])
      .restrict([7, 1], [2, 3])
      .restrict([7, 3], [2, 6])
      .restrict([7, 5], [2, 5])
      .restrict([7, 7], [2, 8])
      .restrict([3, 1], [2, 7])
      .restrict([6, 5], [2, 9])
      .selectCells(FISH_CELLS)
      .explain(
        "Rows 0, 2, 5, and 7 each fit 2 only in columns 1, 3, 5, and 7 — sixteen cells lock 2 into a 4×4 grid. The lone 2s in those columns elsewhere fall away.",
      )
      .build(),
    challenge(
      "jf-c2",
      "Tap the sixteen cells that form the Jellyfish on the digit 8.",
    )
      .puzzle(PUZZLE)
      .restrict([1, 0], [8, 1])
      .restrict([1, 2], [8, 2])
      .restrict([1, 4], [8, 3])
      .restrict([1, 6], [8, 4])
      .restrict([3, 0], [8, 5])
      .restrict([3, 2], [8, 6])
      .restrict([3, 4], [8, 7])
      .restrict([3, 6], [8, 9])
      .restrict([5, 0], [8, 1])
      .restrict([5, 2], [8, 3])
      .restrict([5, 4], [8, 5])
      .restrict([5, 6], [8, 7])
      .restrict([8, 0], [8, 2])
      .restrict([8, 2], [8, 4])
      .restrict([8, 4], [8, 6])
      .restrict([8, 6], [8, 9])
      .restrict([4, 4], [8, 1])
      .selectCells([
        [1, 0],
        [1, 2],
        [1, 4],
        [1, 6],
        [3, 0],
        [3, 2],
        [3, 4],
        [3, 6],
        [5, 0],
        [5, 2],
        [5, 4],
        [5, 6],
        [8, 0],
        [8, 2],
        [8, 4],
        [8, 6],
      ])
      .explain(
        "In rows 1, 3, 5, and 8 the digit 8 only fits in columns 0, 2, 4, and 6. Sixteen cells, locked into a 4×4 Jellyfish.",
      )
      .build(),
    challenge(
      "jf-c3",
      "Tap the sixteen cells that form the Jellyfish on the digit 6.",
    )
      .puzzle(PUZZLE)
      .restrict([0, 0], [6, 1])
      .restrict([0, 4], [6, 2])
      .restrict([0, 6], [6, 3])
      .restrict([0, 8], [6, 4])
      .restrict([2, 0], [6, 5])
      .restrict([2, 4], [6, 7])
      .restrict([2, 6], [6, 8])
      .restrict([2, 8], [6, 9])
      .restrict([4, 0], [6, 1])
      .restrict([4, 4], [6, 2])
      .restrict([4, 6], [6, 3])
      .restrict([4, 8], [6, 5])
      .restrict([6, 0], [6, 7])
      .restrict([6, 4], [6, 8])
      .restrict([6, 6], [6, 9])
      .restrict([6, 8], [6, 1])
      .selectCells([
        [0, 0],
        [0, 4],
        [0, 6],
        [0, 8],
        [2, 0],
        [2, 4],
        [2, 6],
        [2, 8],
        [4, 0],
        [4, 4],
        [4, 6],
        [4, 8],
        [6, 0],
        [6, 4],
        [6, 6],
        [6, 8],
      ])
      .explain(
        "Rows 0, 2, 4, and 6 share columns 0, 4, 6, and 8 as the only spots for 6 — the 4×4 grid is locked.",
      )
      .build(),
  ],
};
