import { demo } from "./builders.ts";
import { challenge } from "./challenge-builder.ts";
import type { Guide } from "./types.ts";

const PUZZLE = [
  "12345678.",
  ".........",
  ".........",
  ".........",
  ".........",
  ".........",
  ".........",
  ".........",
  ".........",
].join("");

const NAKED_SINGLE_DEMO = demo("ns-1", "Only one candidate left")
  .puzzle(PUZZLE)
  .step("Look at the empty cell in the top-right corner.")
  .focus([[0, 8]])
  .step("Its row already contains every digit from 1 to 8.")
  .focus([[0, 8]])
  .highlightRow(0)
  .step("Only 9 can legally go here — it's a Naked Single.")
  .place(0, 8, 9)
  .build();

export const NAKED_SINGLES: Guide = {
  id: "naked-singles",
  title: "Naked Singles",
  level: "beginner",
  summary:
    "A cell has only one candidate left after eliminating every digit already in its row, column, and box.",
  sections: [
    {
      heading: "What to look for",
      body: "Notes in a cell let you see candidates at a glance. When pencil marks (or your own mental list) leave a single digit standing in a cell, that digit is forced — it's the only legal answer there.",
    },
    {
      heading: "Why it's worth chasing",
      body: "Naked Singles are the easiest deductions in sudoku and they often cascade: filling one cell removes its value from peers, which can collapse their candidate sets to one too.",
    },
  ],
  demos: [NAKED_SINGLE_DEMO],
  challenges: [
    challenge("ns-c1", "Which digit must go in the highlighted cell?")
      .puzzle(`12345678.${".".repeat(72)}`)
      .place([0, 8], 9)
      .explain(
        "Row 0 already contains every digit from 1 to 8 — the only legal value left is 9.",
      )
      .build(),
    challenge("ns-c2", "Which digit must go in the highlighted cell?")
      .puzzle(`${".".repeat(27)}.23456789${".".repeat(45)}`)
      .place([3, 0], 1)
      .explain(
        "Columns 1–8 of row 3 already hold 2 through 9. Only 1 is missing, so it must take the empty cell on the left.",
      )
      .build(),
    challenge("ns-c3", "Which digit must go in the highlighted cell?")
      .puzzle(`${".".repeat(54)}1235.6789${".".repeat(18)}`)
      .place([6, 4], 4)
      .explain(
        "Row 6 already carries 1, 2, 3, 5, 6, 7, 8, and 9. The single digit missing is 4 — it goes in the gap.",
      )
      .build(),
  ],
};
