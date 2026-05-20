import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDigitDrag } from "./useDigitDrag.ts";

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

function mockElementFromPoint(getCell: (x: number, y: number) => HTMLElement) {
  document.elementFromPoint = ((x: number, y: number) =>
    getCell(x, y)) as typeof document.elementFromPoint;
}

function makeCellElement(
  row: number,
  col: number,
  rect: { left: number; top: number; width: number; height: number } = {
    left: 0,
    top: 0,
    width: 100,
    height: 100,
  },
): HTMLElement {
  const el = document.createElement("button");
  el.dataset.row = String(row);
  el.dataset.col = String(col);
  el.getBoundingClientRect = () =>
    ({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => rect,
    }) as DOMRect;
  return el;
}

function makeNumpadButton(digit: number): HTMLElement {
  const el = document.createElement("button");
  el.dataset.numpadDigit = String(digit);
  return el;
}

// Default start params. pointerType "mouse" → 10px lift, so a
// clientY resolves 10px higher in local cell coordinates.
function startParams(overrides: Record<string, unknown> = {}) {
  return {
    digit: 5,
    source: { kind: "numpad" as const },
    x: 0,
    y: 0,
    pointerId: 1,
    pointerType: "mouse",
    ...overrides,
  };
}

describe("useDigitDrag", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.elementFromPoint = (() =>
      null) as typeof document.elementFromPoint;
  });

  it("starts with no active drag", () => {
    const { result } = renderHook(() =>
      useDigitDrag({ onDrop: vi.fn(), isDroppable: () => true }),
    );
    expect(result.current.state).toBeNull();
  });

  it("activates a drag when start is called", () => {
    const { result } = renderHook(() =>
      useDigitDrag({ onDrop: vi.fn(), isDroppable: () => true }),
    );
    act(() => {
      result.current.start(startParams({ digit: 5, x: 100, y: 200 }));
    });
    expect(result.current.state).toEqual({
      digit: 5,
      source: { kind: "numpad" },
      x: 100,
      y: 200,
      target: null,
      invalidTarget: false,
      mode: "value",
      lift: 10,
    });
  });

  it("tracks the pointer position and updates target while moving", () => {
    mockElementFromPoint(() => makeCellElement(3, 4));
    const { result } = renderHook(() =>
      useDigitDrag({ onDrop: vi.fn(), isDroppable: () => true }),
    );
    act(() => {
      result.current.start(startParams({ digit: 7 }));
    });
    act(() => {
      document.dispatchEvent(
        pointerEvent("pointermove", { clientX: 150, clientY: 250 }),
      );
    });
    expect(result.current.state).toMatchObject({
      x: 150,
      y: 250,
      target: { row: 3, col: 4 },
      invalidTarget: false,
    });
  });

  it("marks target invalid when isDroppable returns false", () => {
    mockElementFromPoint(() => makeCellElement(0, 0));
    const { result } = renderHook(() =>
      useDigitDrag({ onDrop: vi.fn(), isDroppable: () => false }),
    );
    act(() => {
      result.current.start(startParams({ digit: 1 }));
    });
    act(() => {
      document.dispatchEvent(
        pointerEvent("pointermove", { clientX: 10, clientY: 10 }),
      );
    });
    expect(result.current.state).toMatchObject({
      target: { row: 0, col: 0 },
      invalidTarget: true,
    });
  });

  it("commits onDrop with target when releasing over a droppable cell", () => {
    mockElementFromPoint(() => makeCellElement(5, 6));
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useDigitDrag({ onDrop, isDroppable: () => true }),
    );
    act(() => {
      result.current.start(startParams({ digit: 9 }));
    });
    // Mouse drag (10px lift): clientY 30 → local Y 20 → top half.
    act(() => {
      document.dispatchEvent(
        pointerEvent("pointermove", { clientX: 50, clientY: 30 }),
      );
      document.dispatchEvent(
        pointerEvent("pointerup", { clientX: 50, clientY: 30 }),
      );
    });
    expect(onDrop).toHaveBeenCalledWith(
      9,
      { kind: "numpad" },
      { row: 5, col: 6 },
      "value",
    );
    expect(result.current.state).toBeNull();
  });

  it("computes 'value' mode when the pointer is in the top half of the cell", () => {
    // Cell occupies (0,0)→(100,100). Mouse pointer (50, 30) → local
    // Y 20 after the 10px lift, above the horizontal midline.
    mockElementFromPoint(() => makeCellElement(1, 2));
    const { result } = renderHook(() =>
      useDigitDrag({ onDrop: vi.fn(), isDroppable: () => true }),
    );
    act(() => {
      result.current.start(startParams({ digit: 4 }));
    });
    act(() => {
      document.dispatchEvent(
        pointerEvent("pointermove", { clientX: 50, clientY: 30 }),
      );
    });
    expect(result.current.state?.mode).toBe("value");
  });

  it("computes 'note' mode when the pointer is in the bottom half of the cell", () => {
    // Mouse pointer (50, 85) → local Y 75 after the 10px lift, below
    // the midline.
    mockElementFromPoint(() => makeCellElement(1, 2));
    const { result } = renderHook(() =>
      useDigitDrag({ onDrop: vi.fn(), isDroppable: () => true }),
    );
    act(() => {
      result.current.start(startParams({ digit: 4 }));
    });
    act(() => {
      document.dispatchEvent(
        pointerEvent("pointermove", { clientX: 50, clientY: 85 }),
      );
    });
    expect(result.current.state?.mode).toBe("note");
  });

  it("lifts the hit point above the finger for touch pointers", () => {
    // Touch drag lifts the hit test 46px (10 base + 36 touch).
    // clientY 80 resolves to local Y 34 — above the midline → value.
    // Without the lift the raw clientY 80 would land in the bottom
    // (note) half, so a "value" result proves the lift was applied.
    mockElementFromPoint(() => makeCellElement(2, 3));
    const { result } = renderHook(() =>
      useDigitDrag({ onDrop: vi.fn(), isDroppable: () => true }),
    );
    act(() => {
      result.current.start(startParams({ digit: 6, pointerType: "touch" }));
    });
    act(() => {
      document.dispatchEvent(
        pointerEvent("pointermove", { clientX: 50, clientY: 80 }),
      );
    });
    expect(result.current.state?.lift).toBe(46);
    expect(result.current.state?.mode).toBe("value");
  });

  it("passes the resolved mode to onDrop on release", () => {
    mockElementFromPoint(() => makeCellElement(3, 4));
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useDigitDrag({ onDrop, isDroppable: () => true }),
    );
    act(() => {
      result.current.start(startParams({ digit: 7 }));
    });
    // Mouse pointer (10, 85) → local Y 75 after the 10px lift: below
    // the midline → note.
    act(() => {
      document.dispatchEvent(
        pointerEvent("pointermove", { clientX: 10, clientY: 85 }),
      );
      document.dispatchEvent(
        pointerEvent("pointerup", { clientX: 10, clientY: 85 }),
      );
    });
    expect(onDrop).toHaveBeenCalledWith(
      7,
      { kind: "numpad" },
      { row: 3, col: 4 },
      "note",
    );
  });

  it("cancels without onDrop when released outside a cell", () => {
    mockElementFromPoint(() => null as unknown as HTMLElement);
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useDigitDrag({ onDrop, isDroppable: () => true }),
    );
    act(() => {
      result.current.start(startParams({ digit: 4 }));
    });
    act(() => {
      document.dispatchEvent(
        pointerEvent("pointerup", { clientX: 0, clientY: 0 }),
      );
    });
    expect(onDrop).not.toHaveBeenCalled();
    expect(result.current.state).toBeNull();
  });

  it("cancels without onDrop when released over a non-droppable cell", () => {
    mockElementFromPoint(() => makeCellElement(2, 2));
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useDigitDrag({ onDrop, isDroppable: () => false }),
    );
    act(() => {
      result.current.start(startParams({ digit: 4 }));
    });
    act(() => {
      document.dispatchEvent(
        pointerEvent("pointerup", { clientX: 0, clientY: 0 }),
      );
    });
    expect(onDrop).not.toHaveBeenCalled();
    expect(result.current.state).toBeNull();
  });

  it("ignores pointer events from other pointers", () => {
    mockElementFromPoint(() => makeCellElement(0, 0));
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useDigitDrag({ onDrop, isDroppable: () => true }),
    );
    act(() => {
      result.current.start(startParams({ digit: 1 }));
    });
    act(() => {
      document.dispatchEvent(
        pointerEvent("pointermove", {
          pointerId: 2,
          clientX: 999,
          clientY: 999,
        }),
      );
      document.dispatchEvent(pointerEvent("pointerup", { pointerId: 2 }));
    });
    // The drag should still be active because pointer 2 isn't ours
    expect(result.current.state).not.toBeNull();
    expect(result.current.state?.x).toBe(0);
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("cancels on pointercancel", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useDigitDrag({ onDrop, isDroppable: () => true }),
    );
    act(() => {
      result.current.start(startParams({ digit: 2 }));
    });
    act(() => {
      document.dispatchEvent(pointerEvent("pointercancel"));
    });
    expect(onDrop).not.toHaveBeenCalled();
    expect(result.current.state).toBeNull();
  });

  it("cancels when Escape is pressed", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useDigitDrag({ onDrop, isDroppable: () => true }),
    );
    act(() => {
      result.current.start(startParams({ digit: 3 }));
    });
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(onDrop).not.toHaveBeenCalled();
    expect(result.current.state).toBeNull();
  });

  it("demotes a numpad drag back to a skim when it returns over the numpad", () => {
    // Board cells sit above y=400; the numpad's digit-7 button below it.
    mockElementFromPoint((_x, y) =>
      y >= 400 ? makeNumpadButton(7) : makeCellElement(3, 4),
    );
    const onDrop = vi.fn();
    const onReturnToNumpad = vi.fn();
    const { result } = renderHook(() =>
      useDigitDrag({ onDrop, isDroppable: () => true, onReturnToNumpad }),
    );
    act(() => {
      result.current.start(startParams({ digit: 5, x: 50, y: 450 }));
    });
    // Still over the numpad — the drag has not left it yet, so a move
    // here must not demote it.
    act(() => {
      document.dispatchEvent(
        pointerEvent("pointermove", { clientX: 50, clientY: 460 }),
      );
    });
    expect(onReturnToNumpad).not.toHaveBeenCalled();
    expect(result.current.state).not.toBeNull();
    // Out over the board.
    act(() => {
      document.dispatchEvent(
        pointerEvent("pointermove", { clientX: 50, clientY: 100 }),
      );
    });
    // Back over the numpad — the drag now demotes to a skim.
    act(() => {
      document.dispatchEvent(
        pointerEvent("pointermove", { clientX: 50, clientY: 450 }),
      );
    });
    expect(onReturnToNumpad).toHaveBeenCalledTimes(1);
    expect(onReturnToNumpad).toHaveBeenCalledWith({
      digit: 7,
      pointerId: 1,
      pointerType: "mouse",
    });
    expect(result.current.state).toBeNull();
    expect(onDrop).not.toHaveBeenCalled();
  });
});
