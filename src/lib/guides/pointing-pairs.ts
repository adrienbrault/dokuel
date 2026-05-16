import { demo } from "./builders.ts";
import { challenge } from "./challenge-builder.ts";
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
  challenges: [
    challenge(
      "pp-c1",
      "In the top-left box, digit 5 only fits along row 0. Which digit can be eliminated from the highlighted cell?",
    )
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
      .restrict([0, 5], [3, 5, 9])
      .eliminateAnswer([0, 5], [5])
      .explain(
        "Inside the top-left box, 5 only fits at (0,0) or (0,1) — both on row 0. So 5 is locked into row 0 within that box and can be stripped from every other cell in row 0, including this one.",
      )
      .build(),
    challenge(
      "pp-c2",
      "In the center box, digit 7 is restricted to column 4. Which digit can be eliminated here?",
    )
      .puzzle(PUZZLE)
      .restrict([3, 3], [2, 6])
      .restrict([3, 4], [1, 7, 9])
      .restrict([3, 5], [2, 5])
      .restrict([4, 3], [1, 8])
      .restrict([4, 4], [5, 6, 7])
      .restrict([4, 5], [1, 8])
      .restrict([5, 3], [3, 4])
      .restrict([5, 4], [2, 7, 8])
      .restrict([5, 5], [3, 4])
      .restrict([8, 4], [3, 4, 7])
      .eliminateAnswer([8, 4], [7])
      .explain(
        "Inside the center box, 7 only appears in cells (3,4), (4,4), and (5,4) — all in column 4. So 7 is locked into column 4 within that box and can be stripped from the rest of the column.",
      )
      .build(),
    challenge(
      "pp-c3",
      "In the bottom-right box, digit 3 is locked into row 7. Which digit can be eliminated here?",
    )
      .puzzle(PUZZLE)
      .restrict([6, 6], [1, 5])
      .restrict([6, 7], [2, 4])
      .restrict([6, 8], [1, 5])
      .restrict([7, 6], [3, 6, 8])
      .restrict([7, 7], [3, 6, 9])
      .restrict([7, 8], [3, 8, 9])
      .restrict([8, 6], [2, 4])
      .restrict([8, 7], [5, 7])
      .restrict([8, 8], [5, 7])
      .restrict([7, 1], [2, 3, 6])
      .eliminateAnswer([7, 1], [3])
      .explain(
        "Inside the bottom-right box, 3 only appears in (7,6), (7,7), and (7,8) — all in row 7. So 3 is locked into row 7 inside that box and can be stripped from every other cell in row 7.",
      )
      .build(),
  ],
};
