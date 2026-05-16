import { demo } from "./builders.ts";
import { challenge } from "./challenge-builder.ts";
import type { Guide } from "./types.ts";

const PUZZLE = ".".repeat(81);

// Three rows where 5 is restricted to the same three columns.
const ROW_FISH_CELLS: [number, number][] = [
  [0, 2],
  [0, 5],
  [0, 7],
  [4, 2],
  [4, 5],
  [4, 7],
  [8, 2],
  [8, 5],
  [8, 7],
];

const SWORDFISH_DEMO = demo("sf-1", "Three rows × three columns of 5s")
  .puzzle(PUZZLE)
  .restrict([0, 2], [5, 1])
  .restrict([0, 5], [5, 2])
  .restrict([0, 7], [5, 3])
  .restrict([4, 2], [5, 4])
  .restrict([4, 5], [5, 6])
  .restrict([4, 7], [5, 8])
  .restrict([8, 2], [5, 9])
  .restrict([8, 5], [5, 1])
  .restrict([8, 7], [5, 6])
  .restrict([2, 2], [5, 7])
  .restrict([6, 5], [5, 9])
  .restrict([3, 7], [5, 4])
  .step(
    "In rows 0, 4, and 8, the digit 5 can only land in columns 2, 5, and 7.",
  )
  .highlightRow(0)
  .highlightRow(4)
  .highlightRow(8)
  .focus(ROW_FISH_CELLS)
  .step(
    "Three rows × three columns. The 5s must spread across — one per row, one per column. That's a Swordfish.",
  )
  .focus(ROW_FISH_CELLS)
  .step("So 5 can't appear elsewhere in columns 2, 5, or 7.")
  .eliminate(
    [
      [2, 2],
      [6, 5],
      [3, 7],
    ],
    [5],
  )
  .build();

export const SWORDFISH: Guide = {
  id: "swordfish",
  title: "Swordfish",
  level: "advanced",
  summary:
    "Like an X-Wing, but spanning three rows and three columns. The digit is forced across the 3×3 grid, eliminating it elsewhere in those columns.",
  sections: [
    {
      heading: "The shape",
      body: "Pick a digit. If in three different rows, the digit's candidate cells all live inside the same three columns, you have a Swordfish. The digit must take one cell per row and one cell per column — no other arrangement fits.",
    },
    {
      heading: "What it eliminates",
      body: "Because the digit consumes those three columns across those three rows, no cell outside the three rows can hold the digit in any of the three columns. The same pattern works rotated (three columns sharing three rows).",
    },
    {
      heading: "Spotting one",
      body: "Swordfish are rare. Look for digits where each candidate row has only two or three positions, all clustered within the same three columns. Software hints and notes pay for themselves here — Swordfish patterns are easy to miss by eye.",
    },
  ],
  demos: [SWORDFISH_DEMO],
  challenges: [
    challenge(
      "sf-c1",
      "Tap the nine cells that form the Swordfish on the digit 5.",
    )
      .puzzle(PUZZLE)
      .restrict([0, 2], [5, 1])
      .restrict([0, 5], [5, 2])
      .restrict([0, 7], [5, 3])
      .restrict([4, 2], [5, 4])
      .restrict([4, 5], [5, 6])
      .restrict([4, 7], [5, 8])
      .restrict([8, 2], [5, 9])
      .restrict([8, 5], [5, 1])
      .restrict([8, 7], [5, 6])
      .restrict([2, 2], [5, 7])
      .restrict([6, 5], [5, 9])
      .restrict([3, 7], [5, 4])
      .selectCells([
        [0, 2],
        [0, 5],
        [0, 7],
        [4, 2],
        [4, 5],
        [4, 7],
        [8, 2],
        [8, 5],
        [8, 7],
      ])
      .explain(
        "Rows 0, 4, and 8 each carry 5 only in columns 2, 5, and 7 — those nine cells lock 5 into a 3×3 grid. The lone 5s elsewhere in those columns fall away.",
      )
      .build(),
    challenge(
      "sf-c2",
      "Tap the nine cells that form the Swordfish on the digit 8.",
    )
      .puzzle(PUZZLE)
      .restrict([1, 0], [8, 1])
      .restrict([1, 4], [8, 2])
      .restrict([1, 8], [8, 3])
      .restrict([3, 0], [8, 4])
      .restrict([3, 4], [8, 5])
      .restrict([3, 8], [8, 6])
      .restrict([6, 0], [8, 7])
      .restrict([6, 4], [8, 9])
      .restrict([6, 8], [8, 1])
      .restrict([0, 0], [8, 2])
      .restrict([4, 4], [8, 6])
      .restrict([7, 8], [8, 5])
      .selectCells([
        [1, 0],
        [1, 4],
        [1, 8],
        [3, 0],
        [3, 4],
        [3, 8],
        [6, 0],
        [6, 4],
        [6, 8],
      ])
      .explain(
        "In rows 1, 3, and 6 the digit 8 only fits in columns 0, 4, and 8 — those nine cells lock 8 into a 3×3 Swordfish.",
      )
      .build(),
    challenge(
      "sf-c3",
      "Tap the nine cells that form the Swordfish on the digit 3.",
    )
      .puzzle(PUZZLE)
      .restrict([0, 1], [3, 7])
      .restrict([0, 3], [3, 8])
      .restrict([0, 6], [3, 9])
      .restrict([2, 1], [3, 2])
      .restrict([2, 3], [3, 4])
      .restrict([2, 6], [3, 5])
      .restrict([5, 1], [3, 6])
      .restrict([5, 3], [3, 7])
      .restrict([5, 6], [3, 8])
      .restrict([7, 1], [3, 9])
      .restrict([4, 3], [3, 1])
      .restrict([3, 6], [3, 2])
      .selectCells([
        [0, 1],
        [0, 3],
        [0, 6],
        [2, 1],
        [2, 3],
        [2, 6],
        [5, 1],
        [5, 3],
        [5, 6],
      ])
      .explain(
        "Rows 0, 2, and 5 share columns 1, 3, and 6 as the only spots for 3. The nine cells form the Swordfish; the spare 3s outside those rows lose the digit.",
      )
      .build(),
  ],
};
