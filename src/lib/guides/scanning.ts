import { demo } from "./builders.ts";
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
};
