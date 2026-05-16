import { demo } from "./builders.ts";
import { challenge } from "./challenge-builder.ts";
import type { Guide } from "./types.ts";

const PUZZLE = ".".repeat(81);

const HIDDEN_TRIPLE_DEMO = demo(
  "ht-1",
  "Three digits hidden behind larger notes",
)
  .puzzle(PUZZLE)
  .restrict([0, 0], [1, 2, 5, 6, 8])
  .restrict([0, 3], [1, 5, 8])
  .restrict([0, 6], [1, 6, 8])
  .restrict([0, 1], [3, 4, 7])
  .restrict([0, 4], [3, 7])
  .restrict([0, 7], [4, 7])
  .restrict([0, 8], [3, 9])
  .step("Look at row 0. Where can 2 land?")
  .highlightRow(0)
  .focus([[0, 0]])
  .step("Only (0,0). Now check 5 — and 6.")
  .focus([
    [0, 0],
    [0, 3],
    [0, 6],
  ])
  .step(
    "Digits 2, 5, and 6 each appear only inside those three cells. They're locked in.",
  )
  .focus([
    [0, 0],
    [0, 3],
    [0, 6],
  ])
  .step("Strip every other candidate from the trio.")
  .eliminate(
    [
      [0, 0],
      [0, 3],
      [0, 6],
    ],
    [1, 8],
  )
  .build();

export const HIDDEN_TRIPLES: Guide = {
  id: "hidden-triples",
  title: "Hidden Triples",
  level: "intermediate",
  summary:
    "Three digits in a unit can only land in the same three cells — those cells' other candidates can be removed even when the trio is buried under noise.",
  sections: [
    {
      heading: "Spot it by counting",
      body: "Pick a row, column, or box and walk through missing digits 1–9. Note where each one can go. When three digits each appear only inside the same three cells, you've found a Hidden Triple — even if those three cells also carry other candidates.",
    },
    {
      heading: "What to strip",
      body: "Once you find the trio, the three locked digits must take those three cells. Every other candidate in the cells falls away, often revealing a Naked Triple or Pair beneath.",
    },
  ],
  demos: [HIDDEN_TRIPLE_DEMO],
  challenges: [
    challenge(
      "ht-c1",
      "Three digits in row 0 only fit in the same three cells. Tap them.",
    )
      .puzzle(PUZZLE)
      .restrict([0, 0], [1, 2, 5, 6, 8])
      .restrict([0, 3], [1, 5, 8])
      .restrict([0, 6], [1, 6, 8])
      .restrict([0, 1], [3, 4, 7])
      .restrict([0, 4], [3, 7])
      .restrict([0, 7], [4, 7])
      .restrict([0, 8], [3, 9])
      .selectCells([
        [0, 0],
        [0, 3],
        [0, 6],
      ])
      .explain(
        "Digits 2, 5, and 6 each only appear inside (0,0), (0,3), and (0,6). The trio is locked — strip the other candidates from each.",
      )
      .build(),
    challenge(
      "ht-c2",
      "Three digits in column 2 only fit in the same three cells. Tap them.",
    )
      .puzzle(PUZZLE)
      .restrict([1, 2], [3, 4, 5, 7, 9])
      .restrict([4, 2], [3, 4, 7])
      .restrict([6, 2], [3, 5, 9])
      .restrict([0, 2], [1, 6, 8])
      .restrict([2, 2], [1, 6])
      .restrict([3, 2], [6, 8])
      .restrict([7, 2], [1, 8])
      .restrict([8, 2], [6, 8])
      .selectCells([
        [1, 2],
        [4, 2],
        [6, 2],
      ])
      .explain(
        "Digits 3, 5, and 9 each appear only in (1,2), (4,2), and (6,2) across column 2 — the trio is locked. Strip 4 and 7 from the cells where they're noise.",
      )
      .build(),
    challenge(
      "ht-c3",
      "Three digits inside the bottom-left box only fit in three cells. Tap them.",
    )
      .puzzle(PUZZLE)
      .restrict([6, 0], [1, 2, 4, 5, 8])
      .restrict([6, 1], [1, 2, 5, 8])
      .restrict([7, 0], [1, 2, 4, 5])
      .restrict([6, 2], [3, 6])
      .restrict([7, 1], [3, 9])
      .restrict([7, 2], [6, 7])
      .restrict([8, 0], [6, 9])
      .restrict([8, 1], [3, 7])
      .restrict([8, 2], [6, 7])
      .selectCells([
        [6, 0],
        [6, 1],
        [7, 0],
      ])
      .explain(
        "Digits 1, 2, and 5 each only fit in (6,0), (6,1), and (7,0) inside the box. The trio is locked — the cells' other candidates (4 and 8) drop away.",
      )
      .build(),
  ],
};
