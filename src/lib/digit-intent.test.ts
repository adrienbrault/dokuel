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

describe("digitIntent — hold", () => {
  it("pencils a note into the selected cell and keeps the selection", () => {
    expect(digitIntent({ kind: "hold" }, cellSelected(0, 0))).toEqual({
      effect: { kind: "note", at: null },
      after: { selection: "keep", highlight: false },
      label: "note",
    });
  });

  it("pencils a note into an armed range and keeps it armed", () => {
    // Hold is the one gesture that survives a range, so pairs and
    // triples can be stacked into the same cells without re-dragging.
    const armed = ctx({
      selectedCell: { row: 0, col: 0 },
      selectedCells: new Set([0, 1]),
    });
    expect(digitIntent({ kind: "hold" }, armed)).toEqual({
      effect: { kind: "note", at: null },
      after: { selection: "keep", highlight: false },
      label: "note",
    });
  });

  it("does nothing when nothing is selected", () => {
    expect(digitIntent({ kind: "hold" }, ctx())).toEqual({
      effect: { kind: "none" },
      after: { selection: "keep", highlight: false },
      label: "enter",
    });
  });
});

describe("digitIntent — drop", () => {
  const target = { row: 4, col: 5 };

  it("a value drop places into the cell it lands in", () => {
    expect(
      digitIntent({ kind: "drop", mode: "value", target, from: null }, ctx()),
    ).toEqual({
      effect: { kind: "value", at: target },
      after: { selection: "keep", highlight: false },
      label: "enter",
    });
  });

  it("a note dropped from the numpad releases the selection and spotlights the digit", () => {
    // The selection must not follow the note to the drop target — that
    // would yank the board highlight to wherever the note landed.
    expect(
      digitIntent({ kind: "drop", mode: "note", target, from: null }, ctx()),
    ).toEqual({
      effect: { kind: "note", at: target },
      after: { selection: "release", highlight: true },
      label: "note",
    });
  });

  it("a note dropped from a cell selects the source cell, not the target", () => {
    const from = { row: 3, col: 4 };
    expect(
      digitIntent({ kind: "drop", mode: "note", target, from }, ctx()),
    ).toEqual({
      effect: { kind: "note", at: target },
      after: { selection: from, highlight: false },
      label: "note",
    });
  });
});
