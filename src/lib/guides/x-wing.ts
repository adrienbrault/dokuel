import { demo } from "./builders.ts";
import { challenge } from "./challenge-builder.ts";
import type { Guide } from "./types.ts";

const PUZZLE = ".".repeat(81);

const X_WING_DEMO = demo("xw-1", "A rectangle of 4s locks two columns")
  .puzzle(PUZZLE)
  .restrict([2, 3], [4, 5])
  .restrict([2, 7], [4, 6])
  .restrict([6, 3], [4, 8])
  .restrict([6, 7], [4, 9])
  .restrict([0, 3], [1, 4])
  .restrict([4, 3], [2, 4])
  .restrict([0, 7], [3, 4])
  .restrict([4, 7], [7, 4])
  .step("In row 2, the digit 4 can only land in columns 3 and 7.")
  .highlightRow(2)
  .focus([
    [2, 3],
    [2, 7],
  ])
  .step("Row 6 has the same restriction — 4 goes in column 3 or column 7.")
  .highlightRow(6)
  .focus([
    [6, 3],
    [6, 7],
  ])
  .step("Those four corners form a rectangle — an X-Wing on the digit 4.")
  .focus([
    [2, 3],
    [2, 7],
    [6, 3],
    [6, 7],
  ])
  .step(
    "Two 4s must take opposite corners — locking 4 into columns 3 and 7 for both rows.",
  )
  .focus([
    [2, 3],
    [2, 7],
    [6, 3],
    [6, 7],
  ])
  .step("So 4 can't appear in columns 3 or 7 anywhere else.")
  .eliminate(
    [
      [0, 3],
      [4, 3],
      [0, 7],
      [4, 7],
    ],
    [4],
  )
  .build();

export const X_WING: Guide = {
  id: "x-wing",
  title: "X-Wing",
  level: "advanced",
  summary:
    "Four cells of one digit form a rectangle across two rows and two columns. The digit is locked into those columns, removing it elsewhere on those lines.",
  sections: [
    {
      heading: "The pattern",
      body: "Find a digit that, in two different rows, can only appear in the same two columns. The four candidate cells form the corners of a rectangle. Because each row must take the digit, two of the corners will hold it on a diagonal — and either diagonal claims both columns.",
    },
    {
      heading: "What you eliminate",
      body: "Once the digit is locked into those two columns across two rows, no other cell in those columns can hold it. The same shape also works rotated: two columns that share two candidate rows let you eliminate the digit from the rest of those rows.",
    },
  ],
  demos: [X_WING_DEMO],
  challenges: [
    challenge(
      "xw-c1",
      "Tap the four cells that form the X-Wing on the digit 4.",
    )
      .puzzle(PUZZLE)
      .restrict([2, 3], [4, 5])
      .restrict([2, 7], [4, 6])
      .restrict([6, 3], [4, 8])
      .restrict([6, 7], [4, 9])
      .restrict([0, 3], [1, 4])
      .restrict([4, 3], [2, 4])
      .restrict([0, 7], [3, 4])
      .restrict([4, 7], [7, 4])
      .selectCells([
        [2, 3],
        [2, 7],
        [6, 3],
        [6, 7],
      ])
      .explain(
        "Rows 2 and 6 each carry 4 only in columns 3 and 7 — those four cells lock 4 into two columns, an X-Wing. The extra 4s in column 3 and column 7 are the candidates the pattern eliminates.",
      )
      .build(),
    challenge(
      "xw-c2",
      "Tap the four cells that form the X-Wing on the digit 6.",
    )
      .puzzle(PUZZLE)
      .restrict([1, 1], [6, 2])
      .restrict([1, 8], [6, 9])
      .restrict([7, 1], [6, 3])
      .restrict([7, 8], [6, 5])
      .restrict([3, 1], [6, 7])
      .restrict([5, 8], [6, 4])
      .selectCells([
        [1, 1],
        [1, 8],
        [7, 1],
        [7, 8],
      ])
      .explain(
        "Rows 1 and 7 hold 6 only in columns 1 and 8 — those four cells form the rectangle. The lone 6 in column 1 at (3,1) and the one in column 8 at (5,8) are what the pattern eliminates.",
      )
      .build(),
    challenge(
      "xw-c3",
      "Tap the four cells that form the X-Wing on the digit 9.",
    )
      .puzzle(PUZZLE)
      .restrict([0, 2], [9, 1])
      .restrict([0, 5], [9, 3])
      .restrict([4, 2], [9, 7])
      .restrict([4, 5], [9, 8])
      .restrict([2, 2], [9, 4])
      .restrict([6, 5], [9, 2])
      .selectCells([
        [0, 2],
        [0, 5],
        [4, 2],
        [4, 5],
      ])
      .explain(
        "In rows 0 and 4 the digit 9 only fits in columns 2 and 5 — the four cells form the X-Wing. The extra 9 candidates further down columns 2 and 5 fall away.",
      )
      .build(),
  ],
};
