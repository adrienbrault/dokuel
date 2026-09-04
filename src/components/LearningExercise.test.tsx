import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { LearningExercise } from "./LearningExercise.tsx";

it("lets a player answer a focused technique exercise", () => {
  const onSolved = vi.fn();
  render(
    <LearningExercise
      technique="naked-single"
      prompt="Which digit belongs in row 2, column 3?"
      answer={5}
      onSolved={onSolved}
      onClose={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Answer 5" }));

  expect(screen.getByRole("status")).toHaveTextContent("Correct");
  expect(onSolved).toHaveBeenCalledWith("naked-single");
});

it("reports wrong and correct attempts for technique progress", () => {
  const onAttempt = vi.fn();
  render(
    <LearningExercise
      technique="hidden-single"
      prompt="Which digit belongs in row 2, column 3?"
      answer={5}
      onSolved={vi.fn()}
      onClose={vi.fn()}
      onAttempt={onAttempt}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Answer 4" }));
  fireEvent.click(screen.getByRole("button", { name: "Answer 5" }));

  expect(onAttempt).toHaveBeenNthCalledWith(1, "hidden-single", false);
  expect(onAttempt).toHaveBeenNthCalledWith(2, "hidden-single", true);
});
