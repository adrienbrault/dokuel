import { describe, expect, it } from "vitest";
import { type DigitIntentContext, digitIntent } from "./digit-intent.ts";
import type { Board } from "./types.ts";

function emptyBoard(): Board {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => ({
      value: null as number | null,
      isGiven: false,
      notes: new Set<number>(),
    })),
  );
}

/** Nothing selected unless the overrides say otherwise. */
function ctx(over: Partial<DigitIntentContext> = {}): DigitIntentContext {
  return {
    board: emptyBoard(),
    selectedCell: null,
    selectedCells: new Set<number>(),
    ...over,
  };
}

/** A single cell selected, optionally already holding a value. */
function cellSelected(row: number, col: number, value: number | null = null) {
  const board = emptyBoard();
  board[row]![col]!.value = value;
  return ctx({
    board,
    selectedCell: { row, col },
    selectedCells: new Set([row * 9 + col]),
  });
}

describe("digitIntent — tap", () => {
  it("toggles the digit highlight when nothing is selected", () => {
    expect(digitIntent({ kind: "tap" }, ctx())).toEqual({
      effect: { kind: "toggleHighlight" },
      after: { selection: "keep", highlight: false },
      label: "enter",
    });
  });

  it("places the value into a selected empty cell", () => {
    expect(digitIntent({ kind: "tap" }, cellSelected(0, 0))).toEqual({
      effect: { kind: "value", at: null },
      after: { selection: "keep", highlight: false },
      label: "enter",
    });
  });

  it("drops the selection and spotlights the digit on a filled cell", () => {
    // A tap cannot overwrite a value, so the gesture is repurposed.
    expect(digitIntent({ kind: "tap" }, cellSelected(0, 0, 7))).toEqual({
      effect: { kind: "none" },
      after: { selection: "release", highlight: true },
      label: "enter",
    });
  });

  it("notes into an armed range, releases it, and spotlights the digit", () => {
    const armed = ctx({
      selectedCell: { row: 0, col: 0 },
      selectedCells: new Set([0, 1]),
    });
    expect(digitIntent({ kind: "tap" }, armed)).toEqual({
      effect: { kind: "note", at: null },
      after: { selection: "release", highlight: true },
      label: "note",
    });
  });
});
