import { expect, it } from "vitest";
import { findHint } from "./hint-engine.ts";
import {
  createLearningExercise,
  PRACTICE_TECHNIQUES,
} from "./learning-exercises.ts";
import { presentHint } from "./learning-hints.ts";
import { parsePuzzle } from "./sudoku.ts";

const SOLVED =
  "534678912" +
  "672195348" +
  "198342567" +
  "859761423" +
  "426853791" +
  "713924856" +
  "961537284" +
  "287419635" +
  "345286179";

it("chooses a fresh board for a focused technique exercise", () => {
  const currentPuzzle = `.${SOLVED.slice(1)}`;
  const exercise = createLearningExercise("naked-single", currentPuzzle);

  expect(exercise).not.toBeNull();
  if (!exercise) return;
  expect(exercise.puzzle).not.toBe(currentPuzzle);
  expect(exercise.technique).toBe("naked-single");
  expect(exercise.puzzle).toHaveLength(81);
  expect(exercise.solution).toHaveLength(81);
  expect(exercise.prompt).toContain("new board");
});

it("finds another board when the curated fixture is the source", () => {
  const first = createLearningExercise("naked-single");
  expect(first).not.toBeNull();
  if (!first) return;

  const followUp = createLearningExercise("naked-single", first.puzzle);

  expect(followUp).not.toBeNull();
  expect(followUp?.puzzle).not.toBe(first.puzzle);
  expect(followUp?.technique).toBe("naked-single");
});

it("keeps a fresh variant available for every technique fixture", () => {
  for (const technique of PRACTICE_TECHNIQUES) {
    const first = createLearningExercise(technique);
    expect(first, technique).not.toBeNull();
    if (!first) continue;

    const followUp = createLearningExercise(technique, first.puzzle);
    expect(followUp, technique).not.toBeNull();
    expect(followUp?.puzzle).not.toBe(first.puzzle);
    expect(followUp?.technique).toBe(technique);
  }
});

it("keeps every focused exercise aligned with its claimed technique", () => {
  for (const technique of PRACTICE_TECHNIQUES) {
    const exercise = createLearningExercise(technique);
    expect(exercise, technique).not.toBeNull();
    if (!exercise) continue;

    const hint = findHint(parsePuzzle(exercise.puzzle), exercise.solution);
    expect(hint, technique).not.toBeNull();
    expect(hint?.technique).toBe(technique);
    expect(hint?.position).toEqual(exercise.position);
    expect(hint?.value).toBe(exercise.answer);
  }
});

it("keeps the answer behind the reveal step", () => {
  for (const technique of PRACTICE_TECHNIQUES) {
    const exercise = createLearningExercise(technique);
    if (!exercise) continue;
    const hint = findHint(parsePuzzle(exercise.puzzle), exercise.solution);
    if (!hint) continue;

    for (const step of ["nudge", "pattern", "elimination"] as const) {
      const explanation = presentHint(hint, step).explanation;
      expect(explanation).not.toContain(`Enter ${exercise.answer}`);
      expect(explanation).not.toContain(`answer is ${exercise.answer}`);
      expect(explanation).not.toContain(`for ${exercise.answer}`);
      expect(explanation).not.toContain(`, ${exercise.answer} `);
      expect(explanation).not.toContain(` ${exercise.answer} fits`);
    }

    const reveal = presentHint(hint, "reveal").explanation;
    expect(reveal).toContain(
      hint.eliminationOnly
        ? "Apply that elimination"
        : `Enter ${exercise.answer}`,
    );
  }
});
