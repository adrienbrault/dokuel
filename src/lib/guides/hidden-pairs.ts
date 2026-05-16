import { demo } from "./builders.ts";
import { challenge } from "./challenge-builder.ts";
import type { Guide } from "./types.ts";

const PUZZLE = ".".repeat(81);

const HIDDEN_PAIR_DEMO = demo("hp-1", "Two digits hidden inside larger notes")
  .puzzle(PUZZLE)
  .restrict([0, 0], [1, 4, 5, 8])
  .restrict([0, 1], [1, 4, 5, 8])
  .restrict([0, 4], [1, 5])
  .restrict([0, 8], [1, 5, 9])
  .step("Look at row 0. Where can 4 land?")
  .highlightRow(0)
  .focus([
    [0, 0],
    [0, 1],
  ])
  .step("Only those two cells can hold 4. Where about 8?")
  .focus([
    [0, 0],
    [0, 1],
  ])
  .step("Same two cells — 8 also has nowhere else to go in this row.")
  .focus([
    [0, 0],
    [0, 1],
  ])
  .step(
    "So 4 and 8 must occupy those cells. Their other candidates can be stripped.",
  )
  .focus([
    [0, 0],
    [0, 1],
  ])
  .eliminate(
    [
      [0, 0],
      [0, 1],
    ],
    [1, 5],
  )
  .build();

export const HIDDEN_PAIRS: Guide = {
  id: "hidden-pairs",
  title: "Hidden Pairs",
  level: "intermediate",
  summary:
    "Two digits in a unit can only land in the same two cells — those cells' other candidates can be removed even when the pair is hidden behind larger notes.",
  sections: [
    {
      heading: "Naked vs. hidden",
      body: "A Naked Pair is visible — two cells each show exactly the same two pencil marks. A Hidden Pair is buried inside larger candidate sets: you have to count where each digit can go to notice that the same two cells claim both.",
    },
    {
      heading: "What to do once you spot one",
      body: "Strip every candidate other than the two pair digits from the two cells. This often converts a Hidden Pair into a Naked Pair, which in turn eliminates more candidates elsewhere.",
    },
  ],
  demos: [HIDDEN_PAIR_DEMO],
  challenges: [
    challenge(
      "hp-c1",
      "Two digits in row 0 can only fit in the same two cells. Tap them.",
    )
      .puzzle(PUZZLE)
      .lockDigit({
        unit: { kind: "row", index: 0 },
        digit: 4,
        present: [
          [0, 0],
          [0, 1],
        ],
      })
      .lockDigit({
        unit: { kind: "row", index: 0 },
        digit: 8,
        present: [
          [0, 0],
          [0, 1],
        ],
      })
      .selectCells([
        [0, 0],
        [0, 1],
      ])
      .explain(
        "Digits 4 and 8 only appear in (0,0) and (0,1) anywhere in row 0 — they're a Hidden Pair. Strip their other candidates from those two cells.",
      )
      .build(),
    challenge(
      "hp-c2",
      "A Hidden Pair lives in column 5. Tap the two cells that hold it.",
    )
      .puzzle(PUZZLE)
      .restrict([0, 5], [3, 8])
      .restrict([1, 5], [4, 9])
      .restrict([2, 5], [1, 2, 4, 7])
      .restrict([3, 5], [6, 8])
      .restrict([4, 5], [1, 6])
      .restrict([5, 5], [1, 2, 4, 7])
      .restrict([6, 5], [3, 8, 9])
      .restrict([7, 5], [4, 6])
      .restrict([8, 5], [1, 8, 9])
      .selectCells([
        [2, 5],
        [5, 5],
      ])
      .explain(
        "Walk column 5 by digit: only (2,5) and (5,5) hold 2, and the same two cells are the only spots for 7. {2, 7} is the Hidden Pair — strip 1 and 4 from both cells.",
      )
      .build(),
    challenge(
      "hp-c3",
      "A Hidden Pair lives inside the top-right box. Tap the two cells.",
    )
      .puzzle(PUZZLE)
      .restrict([0, 6], [4, 5, 9])
      .restrict([0, 7], [4, 5, 9])
      .restrict([0, 8], [2, 5, 6])
      .restrict([1, 6], [2, 6, 7])
      .restrict([1, 7], [2, 6, 7])
      .restrict([1, 8], [2, 5, 6])
      .restrict([2, 6], [3, 6, 8])
      .restrict([2, 7], [2, 6])
      .restrict([2, 8], [3, 5, 8])
      .selectCells([
        [0, 6],
        [0, 7],
      ])
      .explain(
        "Scan box 2 by digit: 4 only appears in (0,6) and (0,7); 9 only appears in the same two cells. Both digits are locked there — strip the 5 from each.",
      )
      .build(),
  ],
};
