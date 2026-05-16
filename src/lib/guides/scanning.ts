import { demo } from "./builders.ts";
import { challenge } from "./challenge-builder.ts";
import type { Guide } from "./types.ts";

const PUZZLE = [
  "...5.....",
  ".........",
  ".......5.",
  ".........",
  "5........",
  ".........",
  ".........",
  ".........",
  "..5......",
].join("");

const SCAN_DEMO = demo("scan-box-for-5", "Where can 5 go in the top-left box?")
  .puzzle(PUZZLE)
  .step("We want to find where 5 must go in the top-left box.")
  .highlightBox(0)
  .step(
    "Row 0 already has a 5 in the top-middle box — so 5 can't go in row 0 of this box.",
  )
  .highlightBox(0)
  .highlightRow(0)
  .focus([[0, 3]])
  .step("Row 2 has a 5 too — eliminate row 2.")
  .highlightBox(0)
  .highlightRow(0)
  .highlightRow(2)
  .focus([
    [0, 3],
    [2, 7],
  ])
  .step("Column 0 has a 5 below — strike out column 0.")
  .highlightBox(0)
  .highlightRow(0)
  .highlightRow(2)
  .highlightCol(0)
  .focus([
    [0, 3],
    [2, 7],
    [4, 0],
  ])
  .step("Column 2 has a 5 — strike out column 2.")
  .highlightBox(0)
  .highlightRow(0)
  .highlightRow(2)
  .highlightCol(0)
  .highlightCol(2)
  .focus([
    [0, 3],
    [2, 7],
    [4, 0],
    [8, 2],
  ])
  .step("Only (row 2, col 2) is left — 5 must go there.")
  .place(1, 1, 5)
  .build();

// Variant 1: 6 in top-left box. Blockers leave only (0, 2).
const C1_PUZZLE = [
  ".........",
  ".....6...",
  "........6",
  ".........",
  ".........",
  "6........",
  ".........",
  ".6.......",
  ".........",
].join("");

// Variant 2: 7 in top-right box. Blockers leave only (1, 7).
const C2_PUZZLE = [
  "7........",
  ".........",
  "....7....",
  ".........",
  ".........",
  "......7..",
  ".........",
  "........7",
  ".........",
].join("");

// Variant 3: 3 in bottom-middle box. Blockers leave only (7, 5).
const C3_PUZZLE = [
  "...3.....",
  ".........",
  ".........",
  "....3....",
  ".........",
  ".........",
  "3........",
  ".........",
  "........3",
].join("");

export const SCANNING: Guide = {
  id: "scanning",
  title: "Scanning",
  level: "beginner",
  summary:
    "Pick a digit and check each box to see where it must go, using existing copies of that digit to rule out rows and columns.",
  sections: [
    {
      heading: "Why it works",
      body: "Every box must contain each digit 1–9 exactly once. If a row or column already holds that digit, every cell where they intersect is blocked. When only one cell in the box survives the blockers, that's where the digit goes.",
    },
    {
      heading: "When to reach for it",
      body: "Scanning is the first move on almost every puzzle. Start with the digits that already appear most often on the board — they have the most blockers, so they often resolve a placement immediately.",
    },
  ],
  demos: [SCAN_DEMO],
  challenges: [
    challenge("scan-c1", "Tap the cell in the top-left box where 6 must go.")
      .puzzle(C1_PUZZLE)
      .selectCells([[0, 2]])
      .explain(
        "Rows 1 and 2 already host a 6, knocking out the bottom two rows of the box; columns 0 and 1 also each carry a 6, ruling out the left two columns. Only the top-right cell of the box survives.",
      )
      .build(),
    challenge("scan-c2", "Tap the cell in the top-right box where 7 must go.")
      .puzzle(C2_PUZZLE)
      .selectCells([[1, 7]])
      .explain(
        "Rows 0 and 2 carry 7s, blocking the top and bottom rows of the box. Columns 6 and 8 carry 7s too — leaving only the middle cell of the box's middle row.",
      )
      .build(),
    challenge("scan-c3", "Tap the cell in the bottom-middle box where 3 goes.")
      .puzzle(C3_PUZZLE)
      .selectCells([[7, 5]])
      .explain(
        "Rows 6 and 8 already host a 3, and columns 3 and 4 also each carry one — only the middle-right cell of the bottom-middle box survives.",
      )
      .build(),
  ],
};
