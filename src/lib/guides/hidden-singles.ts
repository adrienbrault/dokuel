import { demo } from "./builders.ts";
import type { Guide } from "./types.ts";

const PUZZLE = [
  ".12.345.6",
  ".........",
  ".........",
  "7........",
  ".........",
  ".......7.",
  ".........",
  ".........",
  ".........",
].join("");

const HIDDEN_SINGLE_DEMO = demo("hs-1", "Only one cell in the row can hold 7")
  .puzzle(PUZZLE)
  .restrict([0, 0], [7, 8, 9])
  .restrict([0, 3], [7, 8, 9])
  .restrict([0, 7], [7, 8, 9])
  .step("Row 0 is missing 7, 8, and 9. Where can 7 go?")
  .highlightRow(0)
  .focus([
    [0, 0],
    [0, 3],
    [0, 7],
  ])
  .step("Column 0 already has a 7 — eliminate 7 from the left empty cell.")
  .highlightCol(0)
  .focus([[3, 0]])
  .eliminate([[0, 0]], [7])
  .step("Column 7 also has a 7 — eliminate 7 from the right empty cell.")
  .highlightCol(7)
  .focus([[5, 7]])
  .eliminate([[0, 7]], [7])
  .step("Only the middle cell can hold 7 — it's a Hidden Single.")
  .place(0, 3, 7)
  .build();

export const HIDDEN_SINGLES: Guide = {
  id: "hidden-singles",
  title: "Hidden Singles",
  level: "beginner",
  summary:
    "A digit can only go in one cell of a row, column, or box — even when that cell still has other candidates.",
  sections: [
    {
      heading: "How it differs from Naked Singles",
      body: "A Naked Single is about the cell — only one digit fits there. A Hidden Single is about the digit — within a unit, only one cell can hold it, even if that cell could hold other digits in isolation.",
    },
    {
      heading: "How to spot them",
      body: "Pick a unit (a row, column, or box) and walk through digits 1–9. For each missing digit, count how many of the unit's empty cells could legally hold it. If the count is exactly one, that's a Hidden Single.",
    },
  ],
  demos: [HIDDEN_SINGLE_DEMO],
};
