import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Board } from "../lib/types.ts";
import { useGameDigitDrag } from "./useGameDigitDrag.ts";

function pointerEvent(type: string, init: Partial<PointerEvent> = {}) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    ...init,
  });
}

function makeCellElement(row: number, col: number): HTMLElement {
  const el = document.createElement("button");
  el.dataset.row = String(row);
  el.dataset.col = String(col);
  const rect = { left: 0, top: 0, width: 100, height: 100 };
  el.getBoundingClientRect = () =>
    ({
      ...rect,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => rect,
    }) as DOMRect;
  return el;
}

function emptyBoard(): Board {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => ({
      value: null,
      isGiven: false,
      notes: new Set<number>(),
    })),
  );
}

function makeGame() {
  return {
    board: emptyBoard(),
    selectCell: vi.fn(),
    deselectCell: vi.fn(),
    placeNumber: vi.fn(),
    placeNoteAt: vi.fn(),
  };
}

// Drop target is cell (0,0), a 100×100 square at the viewport origin.
// With the 10px mouse lift, clientY 30 → local 20 (top/value half)
// and clientY 85 → local 75 (bottom/note half).
const VALUE_Y = 30;
const NOTE_Y = 85;

function drop(
  result: { current: ReturnType<typeof useGameDigitDrag> },
  kind: "numpad" | "cell",
  digit: number,
  clientY: number,
) {
  act(() => {
    if (kind === "numpad") {
      result.current.startNumpadDrag({
        digit,
        x: 0,
        y: 0,
        pointerId: 1,
        pointerType: "mouse",
      });
    } else {
      result.current.startCellDrag({
        digit,
        from: { row: 3, col: 4 },
        x: 0,
        y: 0,
        pointerId: 1,
        pointerType: "mouse",
      });
    }
  });
  act(() => {
    document.dispatchEvent(
      pointerEvent("pointermove", { clientX: 50, clientY }),
    );
    document.dispatchEvent(pointerEvent("pointerup", { clientX: 50, clientY }));
  });
}

describe("useGameDigitDrag", () => {
  beforeEach(() => {
    document.elementFromPoint = (() =>
      makeCellElement(0, 0)) as typeof document.elementFromPoint;
  });

  afterEach(() => {
    document.elementFromPoint = (() =>
      null) as typeof document.elementFromPoint;
  });

  it("a note dropped from the numpad lands at the target without selecting it", () => {
    const game = makeGame();
    const onHighlightDigit = vi.fn();
    const { result } = renderHook(() =>
      useGameDigitDrag({ game, autoEliminateNotes: true, onHighlightDigit }),
    );

    drop(result, "numpad", 5, NOTE_Y);

    expect(game.placeNoteAt).toHaveBeenCalledWith(0, 0, 5);
    expect(game.selectCell).not.toHaveBeenCalled();
    expect(game.placeNumber).not.toHaveBeenCalled();
  });

  it("a note dragged from the numpad keeps the highlight on that digit", () => {
    const game = makeGame();
    const onHighlightDigit = vi.fn();
    const { result } = renderHook(() =>
      useGameDigitDrag({ game, autoEliminateNotes: true, onHighlightDigit }),
    );

    drop(result, "numpad", 5, NOTE_Y);

    expect(game.deselectCell).toHaveBeenCalled();
    expect(onHighlightDigit).toHaveBeenCalledWith(5);
  });

  it("a note dragged from a cell selects the source cell, not the target", () => {
    const game = makeGame();
    const onHighlightDigit = vi.fn();
    const { result } = renderHook(() =>
      useGameDigitDrag({ game, autoEliminateNotes: true, onHighlightDigit }),
    );

    drop(result, "cell", 7, NOTE_Y);

    expect(game.placeNoteAt).toHaveBeenCalledWith(0, 0, 7);
    expect(game.selectCell).toHaveBeenCalledWith(3, 4);
    expect(game.placeNumber).not.toHaveBeenCalled();
    expect(game.deselectCell).not.toHaveBeenCalled();
    expect(onHighlightDigit).not.toHaveBeenCalled();
  });

  it("a value drop selects the cell it lands in", () => {
    const game = makeGame();
    const { result } = renderHook(() =>
      useGameDigitDrag({
        game,
        autoEliminateNotes: true,
        onHighlightDigit: vi.fn(),
      }),
    );

    drop(result, "numpad", 9, VALUE_Y);

    expect(game.selectCell).toHaveBeenCalledWith(0, 0);
    expect(game.placeNumber).toHaveBeenCalledWith(9, true, false);
    expect(game.placeNoteAt).not.toHaveBeenCalled();
  });
});
