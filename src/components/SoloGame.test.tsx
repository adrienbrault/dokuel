import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SoloGame } from "./SoloGame.tsx";

// A solved grid; the puzzle blanks all of row 0 so every numpad digit
// still has a placement remaining and no button is disabled as complete.
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
const PUZZLE = ".".repeat(9) + SOLVED.slice(9);

describe("SoloGame numpad selection", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("keeps the tapped digit selected after the cell deselects", () => {
    render(
      <SoloGame difficulty="easy" initialPuzzle={PUZZLE} onBack={vi.fn()} />,
    );

    // Select an empty cell, then tap a numpad digit (tap = note).
    // GameLayout renders a numpad per responsive breakpoint; the first
    // is the mobile bottom one referenced by the bug report.
    fireEvent.click(screen.getByLabelText("Cell row 1 column 1, empty"));
    const seven = screen.getAllByRole("button", { name: "7" })[0]!;
    fireEvent.pointerDown(seven, { pointerType: "touch" });
    fireEvent.pointerUp(seven, { pointerType: "touch" });

    // The cell deselects on release; the digit the note was placed for
    // should stay selected on the numpad.
    expect(seven.className).toContain("bg-accent");
  });
});
