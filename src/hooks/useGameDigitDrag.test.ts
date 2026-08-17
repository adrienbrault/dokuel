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

// What a drop DOES is digitIntent's answer (see lib/digit-intent.test.ts);
// this hook only has to report what landed where, and from where.
describe("useGameDigitDrag", () => {
  beforeEach(() => {
    document.elementFromPoint = (() =>
      makeCellElement(0, 0)) as typeof document.elementFromPoint;
  });

  afterEach(() => {
    document.elementFromPoint = (() =>
      null) as typeof document.elementFromPoint;
  });

  it("reports a numpad drop on the top half as a value with no source cell", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useGameDigitDrag({ board: emptyBoard(), onDrop }),
    );

    drop(result, "numpad", 9, VALUE_Y);

    expect(onDrop).toHaveBeenCalledWith({
      digit: 9,
      mode: "value",
      target: { row: 0, col: 0 },
      from: null,
    });
  });

  it("reports a cell drop on the bottom half as a note carrying its source", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useGameDigitDrag({ board: emptyBoard(), onDrop }),
    );

    drop(result, "cell", 7, NOTE_Y);

    expect(onDrop).toHaveBeenCalledWith({
      digit: 7,
      mode: "note",
      target: { row: 0, col: 0 },
      from: { row: 3, col: 4 },
    });
  });

  it("ignores a drop while disabled", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useGameDigitDrag({ board: emptyBoard(), disabled: true, onDrop }),
    );

    drop(result, "numpad", 5, VALUE_Y);

    expect(onDrop).not.toHaveBeenCalled();
  });

  it("forwards onReturnToNumpad when a numpad drag returns over the numpad", () => {
    const onDrop = vi.fn();
    const onReturnToNumpad = vi.fn();
    const numpadButton = document.createElement("button");
    numpadButton.dataset.numpadDigit = "8";
    const { result } = renderHook(() =>
      useGameDigitDrag({ board: emptyBoard(), onDrop, onReturnToNumpad }),
    );

    act(() => {
      result.current.startNumpadDrag({
        digit: 3,
        x: 0,
        y: 0,
        pointerId: 1,
        pointerType: "touch",
      });
    });
    // Leave the numpad over a board cell, then return over the numpad.
    act(() => {
      document.dispatchEvent(
        pointerEvent("pointermove", { clientX: 50, clientY: 50 }),
      );
    });
    act(() => {
      document.elementFromPoint = (() =>
        numpadButton) as typeof document.elementFromPoint;
      document.dispatchEvent(
        pointerEvent("pointermove", { clientX: 50, clientY: 500 }),
      );
    });

    expect(onReturnToNumpad).toHaveBeenCalledWith({
      digit: 8,
      pointerId: 1,
      pointerType: "touch",
    });
    expect(onDrop).not.toHaveBeenCalled();
  });
});
