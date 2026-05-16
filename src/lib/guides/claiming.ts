import { demo } from "./builders.ts";
import { challenge } from "./challenge-builder.ts";
import type { Guide } from "./types.ts";

const PUZZLE = ".".repeat(81);

const CLAIMING_DEMO = demo(
  "cl-1",
  "A line claims a digit, knocking it out of the rest of the box",
)
  .puzzle(PUZZLE)
  .restrict([0, 3], [3, 5, 9])
  .restrict([0, 4], [3, 5])
  .restrict([0, 5], [5, 9])
  .restrict([0, 0], [1, 2, 4, 6, 7, 8])
  .restrict([0, 1], [1, 2, 4, 6, 7, 8])
  .restrict([0, 2], [1, 2, 4, 6, 7, 8])
  .restrict([0, 6], [1, 2, 4, 6, 7, 8])
  .restrict([0, 7], [1, 2, 4, 6, 7, 8])
  .restrict([0, 8], [1, 2, 4, 6, 7, 8])
  .restrict([1, 4], [3, 5, 9])
  .restrict([2, 5], [3, 5, 9])
  .step("Look at where the digit 5 can land in row 0.")
  .highlightRow(0)
  .focus([
    [0, 3],
    [0, 4],
    [0, 5],
  ])
  .step(
    "All three candidate cells live inside the top-middle box — row 0 has claimed 5 in that box.",
  )
  .highlightBox(1)
  .focus([
    [0, 3],
    [0, 4],
    [0, 5],
  ])
  .step("So 5 can't appear anywhere else in the top-middle box.")
  .focus([
    [0, 3],
    [0, 4],
    [0, 5],
  ])
  .eliminate(
    [
      [1, 4],
      [2, 5],
    ],
    [5],
  )
  .build();

export const CLAIMING: Guide = {
  id: "claiming",
  title: "Claiming",
  level: "intermediate",
  summary:
    "When a digit's candidates in a row or column all sit inside one box, the digit is claimed by that line — erase it from the rest of the box.",
  sections: [
    {
      heading: "Pointing's mirror",
      body: "Pointing Pairs work in the box-to-line direction: a digit cornered in one row of a box clears out the rest of the row. Claiming runs the other way: a digit cornered in one box of a row (or column) clears out the rest of the box.",
    },
    {
      heading: "Where to look",
      body: "Walk each row and column. When a missing digit's candidate cells all fall inside the same 3×3 box, the line has claimed the digit — every other cell in that box can drop it from its notes.",
    },
  ],
  demos: [CLAIMING_DEMO],
  challenges: [
    challenge(
      "cl-c1",
      "Row 0 has claimed digit 5 inside the top-middle box. Which digit can be eliminated from the highlighted cell?",
    )
      .puzzle(PUZZLE)
      .lockDigit({
        unit: { kind: "row", index: 0 },
        digit: 5,
        present: [
          [0, 3],
          [0, 4],
          [0, 5],
        ],
      })
      .restrict([1, 4], [3, 5, 9])
      .eliminateAnswer([1, 4], [5])
      .explain(
        "Row 0's only spots for 5 are (0,3), (0,4), and (0,5) — all inside the top-middle box. So 5 is locked into row 0 within the box, and every other cell of the box drops 5 from its notes.",
      )
      .build(),
    challenge(
      "cl-c2",
      "Column 4 has claimed digit 7 inside the center box. Which digit can be eliminated here?",
    )
      .puzzle(PUZZLE)
      .lockDigit({
        unit: { kind: "col", index: 4 },
        digit: 7,
        present: [
          [3, 4],
          [4, 4],
          [5, 4],
        ],
      })
      .restrict([4, 3], [6, 7, 8])
      .eliminateAnswer([4, 3], [7])
      .explain(
        "Column 4's only candidates for 7 are (3,4), (4,4), and (5,4) — all inside the center box. The line claims 7, so the rest of the center box loses it.",
      )
      .build(),
    challenge(
      "cl-c3",
      "Row 7 has claimed digit 2 inside the bottom-middle box. Which digit can be eliminated here?",
    )
      .puzzle(PUZZLE)
      .lockDigit({
        unit: { kind: "row", index: 7 },
        digit: 2,
        present: [
          [7, 3],
          [7, 4],
          [7, 5],
        ],
      })
      .restrict([6, 4], [2, 3, 9])
      .eliminateAnswer([6, 4], [2])
      .explain(
        "Row 7 only fits 2 inside (7,3), (7,4), and (7,5) — all in the bottom-middle box. The line claims 2 within the box; the box's other cells drop the digit.",
      )
      .build(),
  ],
};
