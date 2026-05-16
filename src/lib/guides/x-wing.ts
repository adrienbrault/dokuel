import { demo } from "./builders.ts";
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
};
