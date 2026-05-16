import { demo } from "./builders.ts";
import type { Guide } from "./types.ts";

const PUZZLE = ".".repeat(81);

const POINTING_PAIR_DEMO = demo("pp-1", "A box locks a digit into one row")
  .puzzle(PUZZLE)
  .restrict([0, 0], [2, 5, 7])
  .restrict([0, 1], [3, 5, 6])
  .restrict([0, 2], [1, 4])
  .restrict([1, 0], [2, 8])
  .restrict([1, 1], [3, 9])
  .restrict([1, 2], [6, 7])
  .restrict([2, 0], [4, 9])
  .restrict([2, 1], [7, 8])
  .restrict([2, 2], [1, 2])
  .restrict([0, 4], [3, 5, 9])
  .restrict([0, 8], [1, 5, 6])
  .step("Inside the top-left box, where can 5 go?")
  .highlightBox(0)
  .focus([
    [0, 0],
    [0, 1],
  ])
  .step(
    "Only those two cells — and both are in row 0. So 5 must end up in row 0 inside this box.",
  )
  .focus([
    [0, 0],
    [0, 1],
  ])
  .step(
    "That means 5 can't appear anywhere else in row 0 — outside the box too.",
  )
  .focus([
    [0, 0],
    [0, 1],
  ])
  .eliminate(
    [
      [0, 4],
      [0, 8],
    ],
    [5],
  )
  .build();

export const POINTING_PAIRS: Guide = {
  id: "pointing-pairs",
  title: "Pointing Pairs",
  level: "intermediate",
  summary:
    "When a digit's candidates inside a box all sit on one row or column, you can erase that digit from the rest of that line.",
  sections: [
    {
      heading: "The lock",
      body: "Each box must contain every digit. If a digit's only options inside the box live on a single row or column, the digit is forced onto that line within the box — so it has nowhere left to go on the same line outside the box.",
    },
    {
      heading: "Where to look",
      body: "Walk through each box and each missing digit. Whenever the digit's candidate cells inside the box all share a row or column, you've found a Pointing Pair (or Triple). The line outside the box loses that digit from every cell.",
    },
  ],
  demos: [POINTING_PAIR_DEMO],
};
