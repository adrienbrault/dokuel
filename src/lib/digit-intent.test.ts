import { describe, expect, it, vi } from "vitest";
import {
  applyDigitIntent,
  type DigitIntentContext,
  digitIntent,
} from "./digit-intent.ts";
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

describe("digitIntent — keyboard", () => {
  it("places the value into the selection when notes mode is off", () => {
    expect(
      digitIntent({ kind: "key", notesMode: false }, cellSelected(0, 0)),
    ).toEqual({
      effect: { kind: "value", at: null },
      after: { selection: "keep", highlight: false },
      label: "enter",
    });
  });

  it("pencils a note and releases the selection when notes mode is on", () => {
    // Unlike a range tap, the keyboard note does NOT spotlight the digit
    // — the N-then-1 workflow just moves on.
    expect(
      digitIntent({ kind: "key", notesMode: true }, cellSelected(0, 0)),
    ).toEqual({
      effect: { kind: "note", at: null },
      after: { selection: "release", highlight: false },
      label: "note",
    });
  });

  it("does nothing when nothing is selected", () => {
    expect(digitIntent({ kind: "key", notesMode: false }, ctx())).toEqual({
      effect: { kind: "none" },
      after: { selection: "keep", highlight: false },
      label: "enter",
    });
  });
});

describe("applyDigitIntent", () => {
  function makeOps() {
    return {
      placeNumber: vi.fn(),
      placeNoteAt: vi.fn(),
      selectCell: vi.fn(),
      deselectCell: vi.fn(),
      toggleHighlight: vi.fn(),
      setHighlight: vi.fn(),
    };
  }

  /** Asserts `first` was called before `second`, both having been called. */
  function expectCalledBefore(
    first: { mock: { invocationCallOrder: number[] } },
    second: { mock: { invocationCallOrder: number[] } },
  ) {
    const [a, b] = [first, second].map(
      (m) => m.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    ) as [number, number];
    expect(a).toBeLessThan(b);
  }

  it("notes into an armed range BEFORE releasing it", () => {
    // The engine's batch-note branch reads selectedCells, so deselecting
    // first would silently turn the whole gesture into a no-op.
    const ops = makeOps();
    const armed = ctx({
      selectedCell: { row: 0, col: 0 },
      selectedCells: new Set([0, 1]),
    });
    applyDigitIntent(digitIntent({ kind: "tap" }, armed), 6, ops);

    expect(ops.placeNumber).toHaveBeenCalledWith(6, true);
    expectCalledBefore(ops.placeNumber, ops.deselectCell);
    expect(ops.setHighlight).toHaveBeenCalledWith(6);
  });

  it("selects a value drop's target BEFORE placing the value", () => {
    const ops = makeOps();
    const target = { row: 4, col: 5 };
    applyDigitIntent(
      digitIntent({ kind: "drop", mode: "value", target, from: null }, ctx()),
      9,
      ops,
    );

    expect(ops.selectCell).toHaveBeenCalledWith(4, 5);
    expect(ops.placeNumber).toHaveBeenCalledWith(9, false);
    expectCalledBefore(ops.selectCell, ops.placeNumber);
  });

  it("lands a note drop at its target BEFORE selecting the source cell", () => {
    const ops = makeOps();
    const target = { row: 4, col: 5 };
    const from = { row: 3, col: 4 };
    applyDigitIntent(
      digitIntent({ kind: "drop", mode: "note", target, from }, ctx()),
      7,
      ops,
    );

    expect(ops.placeNoteAt).toHaveBeenCalledWith(4, 5, 7);
    expect(ops.selectCell).toHaveBeenCalledWith(3, 4);
    expectCalledBefore(ops.placeNoteAt, ops.selectCell);
    expect(ops.setHighlight).not.toHaveBeenCalled();
  });

  it("toggles the highlight and touches nothing else", () => {
    const ops = makeOps();
    applyDigitIntent(digitIntent({ kind: "tap" }, ctx()), 3, ops);

    expect(ops.toggleHighlight).toHaveBeenCalledWith(3);
    expect(ops.placeNumber).not.toHaveBeenCalled();
    expect(ops.deselectCell).not.toHaveBeenCalled();
  });

  it("runs nothing for a hold with no selection", () => {
    const ops = makeOps();
    applyDigitIntent(digitIntent({ kind: "hold" }, ctx()), 3, ops);

    for (const op of Object.values(ops)) expect(op).not.toHaveBeenCalled();
  });
});
