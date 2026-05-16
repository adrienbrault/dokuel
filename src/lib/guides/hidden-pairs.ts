import { demo } from "./builders.ts";
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
};
