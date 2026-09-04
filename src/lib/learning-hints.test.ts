import { expect, it } from "vitest";
import { findHint } from "./hint-engine.ts";
import { createLearningExercise } from "./learning-exercises.ts";
import { presentHint } from "./learning-hints.ts";
import { parsePuzzle } from "./sudoku.ts";

it("explains hidden-single elimination without giving the answer away", () => {
  const hint = presentHint(
    {
      position: { row: 1, col: 2 },
      value: 5,
      technique: "hidden-single",
      explanation: "In row 2, 5 can only go here.",
      relatedCells: [{ row: 1, col: 0 }],
    },
    "elimination",
  );

  expect(hint.explanation).toContain("no other legal cell");
  expect(hint.explanation).toContain("highlighted house");
  expect(hint.explanation).not.toContain("Cross out the highlighted house");
  expect(hint.explanation).not.toContain("5");
});

it("describes intermediate eliminations before a decisive technique", () => {
  const exercise = createLearningExercise("hidden-pair");
  expect(exercise).not.toBeNull();
  const hint = findHint(parsePuzzle(exercise!.puzzle), exercise!.solution);
  expect(hint).not.toBeNull();

  const elimination = presentHint(hint!, "elimination");
  expect(elimination.explanation).toContain("Earlier deductions");
  expect(elimination.explanation).not.toContain(String(hint!.value));
});
