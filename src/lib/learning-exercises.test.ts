import { expect, it } from "vitest";
import { createLearningExercise } from "./learning-exercises.ts";

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
  expect(exercise!.puzzle).not.toBe(currentPuzzle);
  expect(exercise!.technique).toBe("naked-single");
  expect(exercise!.puzzle).toHaveLength(81);
  expect(exercise!.solution).toHaveLength(81);
  expect(exercise!.prompt).toContain("new board");
});

it("finds another board when the curated fixture is the source", () => {
  const first = createLearningExercise("naked-single");
  expect(first).not.toBeNull();

  const followUp = createLearningExercise("naked-single", first!.puzzle);

  expect(followUp).not.toBeNull();
  expect(followUp!.puzzle).not.toBe(first!.puzzle);
  expect(followUp!.technique).toBe("naked-single");
});
