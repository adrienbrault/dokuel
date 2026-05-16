import { demo } from "./builders.ts";
import { challenge } from "./challenge-builder.ts";
import type { Guide } from "./types.ts";

const PUZZLE = ".".repeat(81);

const NAKED_TRIPLE_DEMO = demo(
  "nt-1",
  "Three cells, three digits — locked together",
)
  .puzzle(PUZZLE)
  .restrict([0, 0], [2, 5, 9])
  .restrict([0, 1], [2, 5])
  .restrict([0, 2], [5, 9])
  .step(
    "Row 0 has three empty cells whose candidates are all subsets of {2, 5, 9}.",
  )
  .highlightRow(0)
  .focus([
    [0, 0],
    [0, 1],
    [0, 2],
  ])
  .step(
    "Those three cells must hold 2, 5, and 9 between them — one digit each, order unknown.",
  )
  .focus([
    [0, 0],
    [0, 1],
    [0, 2],
  ])
  .step("So 2, 5, and 9 can't appear anywhere else in this row.")
  .focus([
    [0, 0],
    [0, 1],
    [0, 2],
  ])
  .eliminate(
    [
      [0, 4],
      [0, 7],
    ],
    [2, 5, 9],
  )
  .build();

export const NAKED_TRIPLES: Guide = {
  id: "naked-triples",
  title: "Naked Triples",
  level: "intermediate",
  summary:
    "Three cells in a unit share candidates from the same three digits — those digits are locked in and can be stripped from every other cell.",
  sections: [
    {
      heading: "The shape",
      body: "A Naked Triple is three cells in the same row, column, or box whose combined candidates use only three digits. Each cell may carry all three or just two of them, but together they cover exactly three values.",
    },
    {
      heading: "Why it locks",
      body: "Those three cells must take the three digits between them — there's no other arrangement that satisfies each cell's options without repeating. So no other cell in the unit can hold any of the three digits.",
    },
  ],
  demos: [NAKED_TRIPLE_DEMO],
  challenges: [
    challenge(
      "nt-c1",
      "Tap the three cells in row 0 that form the Naked Triple.",
    )
      .puzzle(PUZZLE)
      .restrict([0, 0], [2, 5, 9])
      .restrict([0, 1], [2, 5])
      .restrict([0, 2], [5, 9])
      .selectCells([
        [0, 0],
        [0, 1],
        [0, 2],
      ])
      .explain(
        "All three cells' candidates are drawn from {2, 5, 9} only. The trio is locked — 2, 5, and 9 can be eliminated from every other cell of row 0.",
      )
      .build(),
    challenge(
      "nt-c2",
      "Tap the three cells in column 4 that form the Naked Triple.",
    )
      .puzzle(PUZZLE)
      .restrict([1, 4], [3, 6, 8])
      .restrict([4, 4], [3, 6])
      .restrict([7, 4], [6, 8])
      .selectCells([
        [1, 4],
        [4, 4],
        [7, 4],
      ])
      .explain(
        "{3, 6, 8} between them. The three cells must take those three digits — column 4's other cells lose 3, 6, and 8 from their notes.",
      )
      .build(),
    challenge(
      "nt-c3",
      "Tap the three cells in the center box that form the Naked Triple.",
    )
      .puzzle(PUZZLE)
      .restrict([3, 3], [1, 4, 7])
      .restrict([4, 5], [1, 4])
      .restrict([5, 4], [4, 7])
      .selectCells([
        [3, 3],
        [4, 5],
        [5, 4],
      ])
      .explain(
        "Inside the center box those three cells together carry only {1, 4, 7}. They're locked — the rest of the box can strip 1, 4, and 7.",
      )
      .build(),
  ],
};
