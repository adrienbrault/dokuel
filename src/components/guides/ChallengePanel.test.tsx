import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { challenge } from "../../lib/guides/challenge-builder.ts";
import { ChallengePanel } from "./ChallengePanel.tsx";

const EMPTY_PUZZLE = ".".repeat(81);

describe("ChallengePanel", () => {
  it("shows the prompt of the first challenge", () => {
    const challenges = [
      challenge("c1", "Where does 9 go?")
        .puzzle(EMPTY_PUZZLE)
        .place([0, 0], 9)
        .explain("Forced.")
        .build(),
    ];
    render(<ChallengePanel challenges={challenges} />);
    expect(screen.getByText("Where does 9 go?")).toBeDefined();
  });

  it("reveals the explanation after a place-kind answer is checked", () => {
    const challenges = [
      challenge("c1", "Place the digit.")
        .puzzle(EMPTY_PUZZLE)
        .restrict([0, 0], [9])
        .place([0, 0], 9)
        .explain("Only 9 is legal here.")
        .build(),
    ];
    render(<ChallengePanel challenges={challenges} />);
    fireEvent.click(screen.getByRole("button", { name: "9" }));
    expect(screen.getByText("Only 9 is legal here.")).toBeDefined();
  });

  it("marks a place-kind answer wrong when the user picks the wrong digit", () => {
    const challenges = [
      challenge("c1", "Place the digit.")
        .puzzle(EMPTY_PUZZLE)
        .place([0, 0], 9)
        .explain("Only 9 fits.")
        .build(),
    ];
    render(<ChallengePanel challenges={challenges} />);
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    expect(screen.getByText(/Not quite/)).toBeDefined();
  });

  it("eliminate-kind challenge accepts the right digit set on Check", () => {
    const challenges = [
      challenge("c1", "Eliminate the digit.")
        .puzzle(EMPTY_PUZZLE)
        .restrict([2, 2], [4, 6, 8])
        .eliminateAnswer([2, 2], [6])
        .explain("6 is forced out.")
        .build(),
    ];
    render(<ChallengePanel challenges={challenges} />);
    fireEvent.click(screen.getByRole("button", { name: "6" }));
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText(/Correct/)).toBeDefined();
  });

  it("Try another rotates to the next variant", () => {
    const challenges = [
      challenge("a", "First prompt.")
        .puzzle(EMPTY_PUZZLE)
        .place([0, 0], 1)
        .explain("One.")
        .build(),
      challenge("b", "Second prompt.")
        .puzzle(EMPTY_PUZZLE)
        .place([0, 0], 2)
        .explain("Two.")
        .build(),
    ];
    render(<ChallengePanel challenges={challenges} />);
    fireEvent.click(screen.getByRole("button", { name: "1" }));
    fireEvent.click(screen.getByRole("button", { name: "Try another" }));
    expect(screen.getByText("Second prompt.")).toBeDefined();
  });
});
