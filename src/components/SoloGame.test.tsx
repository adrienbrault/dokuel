import { act, fireEvent, render, screen } from "@testing-library/react";
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
    document.elementFromPoint = (() =>
      null) as typeof document.elementFromPoint;
  });

  it("closes the settings popover on Escape and returns focus to the gear", () => {
    render(
      <SoloGame difficulty="easy" initialPuzzle={PUZZLE} onBack={vi.fn()} />,
    );

    const gear = screen.getByRole("button", { name: "Settings" });
    fireEvent.click(gear);
    expect(screen.getByText("Numpad position")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByText("Numpad position")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(gear);
  });

  it("places a value and keeps the cell selected after a numpad tap", () => {
    render(
      <SoloGame difficulty="easy" initialPuzzle={PUZZLE} onBack={vi.fn()} />,
    );

    // Select an empty cell, then tap a numpad digit — a tap commits the value.
    fireEvent.click(screen.getByLabelText(/^Cell row 1 column 1, empty/));
    const seven = screen.getByRole("button", { name: "7" });
    fireEvent.pointerDown(seven, { pointerType: "touch" });
    fireEvent.pointerUp(seven, { pointerType: "touch" });

    // The value lands and the cell stays selected so the player can keep
    // working it without re-tapping the cell.
    const filled = screen.getByLabelText(/^Cell row 1 column 1, value 7/);
    expect(filled.className).toContain("cell-selected-glow");
  });

  it("deselects the cell and highlights the digit when a digit is tapped on a filled cell", () => {
    render(
      <SoloGame difficulty="easy" initialPuzzle={PUZZLE} onBack={vi.fn()} />,
    );

    // Select a filled (given) cell, then tap a numpad digit — a tap can't
    // overwrite a filled cell, so it highlights the digit instead.
    const filled = screen.getByLabelText(/^Cell row 2 column 1, value 6/);
    fireEvent.click(filled);
    expect(filled.className).toContain("cell-selected-glow");

    const three = screen.getByRole("button", { name: "3" });
    fireEvent.pointerDown(three, { pointerType: "touch" });
    fireEvent.pointerUp(three, { pointerType: "touch" });

    // The cell is no longer selected, and the tapped digit drives the
    // board's same-number highlight.
    expect(
      screen.getByLabelText(/^Cell row 2 column 1, value 6/).className,
    ).not.toContain("cell-selected-glow");
    expect(
      screen.getByLabelText(/^Cell row 2 column 7, value 3/).className,
    ).toContain("bg-cell-same-number");
  });

  it("places a pencil note and keeps the cell selected after a numpad hold", () => {
    render(
      <SoloGame difficulty="easy" initialPuzzle={PUZZLE} onBack={vi.fn()} />,
    );

    // Select an empty cell, then hold a numpad digit — a hold adds a note.
    fireEvent.click(screen.getByLabelText(/^Cell row 1 column 1, empty/));
    const seven = screen.getByRole("button", { name: "7" });
    fireEvent.pointerDown(seven, { pointerType: "touch" });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.pointerUp(seven, { pointerType: "touch" });

    // The cell holds no value (still "empty") but carries the note, and
    // stays selected for continued penciling.
    const cell = screen.getByLabelText(/^Cell row 1 column 1, empty/);
    expect(cell.textContent).toContain("7");
    expect(cell.className).toContain("cell-selected-glow");
  });

  it("toggles the digit highlight on a numpad tap with no cell selected", () => {
    render(
      <SoloGame difficulty="easy" initialPuzzle={PUZZLE} onBack={vi.fn()} />,
    );

    // No cell selected: a tap filters the board instead of placing a value.
    const five = screen.getByRole("button", { name: "5" });
    fireEvent.pointerDown(five, { pointerType: "touch" });
    fireEvent.pointerUp(five, { pointerType: "touch" });

    // Row 2 column 6 holds 5 in PUZZLE and picks up the same-number
    // highlight; no empty cell gained a value.
    expect(
      screen.getByLabelText(/^Cell row 2 column 6, value 5/).className,
    ).toContain("bg-cell-same-number");
    expect(screen.queryByLabelText(/^Cell row 1 column 1, value 5/)).toBeNull();
  });

  it("highlights the skimmed digit on the board while a cell is selected", () => {
    render(
      <SoloGame difficulty="easy" initialPuzzle={PUZZLE} onBack={vi.fn()} />,
    );

    // Select an empty cell, then start skimming across the numpad.
    fireEvent.click(screen.getByLabelText(/^Cell row 1 column 1, empty/));
    const three = screen.getByRole("button", { name: "3" });
    const five = screen.getByRole("button", { name: "5" });
    fireEvent.pointerDown(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    // Pan along the numpad axis past the threshold to enter skim mode.
    fireEvent.pointerMove(three, { pointerId: 1, clientX: 50, clientY: 0 });
    // The finger crosses into digit 5.
    document.elementFromPoint = (() =>
      five) as typeof document.elementFromPoint;
    act(() => {
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerId: 1,
          clientX: 100,
          clientY: 0,
        }),
      );
    });

    // The board's same-number highlight should follow the skimmed digit.
    expect(
      screen.getByLabelText(/^Cell row 2 column 6, value 5/).className,
    ).toContain("bg-cell-same-number");
  });

  it("stops a numpad drag and resumes the skim when it returns to the numpad", () => {
    render(
      <SoloGame difficulty="easy" initialPuzzle={PUZZLE} onBack={vi.fn()} />,
    );

    const three = screen.getByRole("button", { name: "3" });
    const five = screen.getByRole("button", { name: "5" });
    const boardCell = screen.getByLabelText(/^Cell row 1 column 1, empty/);

    // Press digit 3 and pan straight off the numpad → drag-to-place.
    fireEvent.pointerDown(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 50,
    });
    expect(screen.queryByTestId("digit-drag-indicator")).not.toBeNull();

    // Drag over a board cell — the drag has now left the numpad.
    document.elementFromPoint = (() =>
      boardCell) as typeof document.elementFromPoint;
    act(() => {
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerId: 1,
          clientX: 40,
          clientY: 20,
        }),
      );
    });

    // Bring the finger back over numpad digit 5 → the drag stops and the
    // skim resumes on the digit now under the finger.
    document.elementFromPoint = (() =>
      five) as typeof document.elementFromPoint;
    act(() => {
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerId: 1,
          clientX: 0,
          clientY: 0,
        }),
      );
    });

    expect(screen.queryByTestId("digit-drag-indicator")).toBeNull();
    expect(five.className).toContain("bg-accent");
    expect(three.className).not.toContain("bg-accent");
  });

  // The whole point of a numpad drag is that it LANDS something: press,
  // pull off the pad, aim at a cell, release. Every layer of that path
  // was covered in isolation and nothing asserted the journey end to
  // end, so these two pin it at the game's own surface — a real board,
  // a real numpad, one continuous gesture, and the digit visible in the
  // cell afterwards.
  //
  // A mouse pointer is deliberate: it takes no touch lift, so the drop
  // Y maps straight onto the cell's local Y and the value/note split at
  // the midline is stated by the coordinates themselves.
  function dropDraggedDigit(digitLabel: string, dropY: number) {
    const digit = screen.getByRole("button", { name: digitLabel });
    const cell = screen.getByLabelText(/^Cell row 1 column 1, empty/);
    // jsdom gives every element a zero-sized rect, and a zero-height
    // cell has no halves to aim at — cellModeAt would answer "value"
    // whatever the pointer does. Give the target a real 100×100 box.
    cell.getBoundingClientRect = (() => ({
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    })) as typeof cell.getBoundingClientRect;

    fireEvent.pointerDown(digit, {
      pointerType: "mouse",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    // Straight off the pad toward the board — perpendicular to a bottom
    // numpad, so the press classifies as a drag rather than a skim.
    fireEvent.pointerMove(digit, {
      pointerType: "mouse",
      pointerId: 1,
      clientX: 0,
      clientY: 50,
    });
    expect(screen.queryByTestId("digit-drag-indicator")).not.toBeNull();

    document.elementFromPoint = (() =>
      cell) as typeof document.elementFromPoint;
    act(() => {
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerId: 1,
          clientX: 50,
          clientY: dropY,
        }),
      );
      document.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          pointerId: 1,
          clientX: 50,
          clientY: dropY,
        }),
      );
    });
  }

  it("places the digit when a numpad drag is dropped on a cell's top half", () => {
    render(
      <SoloGame difficulty="easy" initialPuzzle={PUZZLE} onBack={vi.fn()} />,
    );

    dropDraggedDigit("5", 30);

    expect(
      screen.getByLabelText(/^Cell row 1 column 1, value 5/),
    ).toBeInTheDocument();
  });

  it("pencils a note when a numpad drag is dropped on a cell's bottom half", () => {
    render(
      <SoloGame difficulty="easy" initialPuzzle={PUZZLE} onBack={vi.fn()} />,
    );

    dropDraggedDigit("7", 85);

    // The cell takes no value — the digit landed in its note grid.
    const cell = screen.getByLabelText(/^Cell row 1 column 1, empty/);
    expect(cell.textContent).toContain("7");
  });
});
