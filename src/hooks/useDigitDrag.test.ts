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

function makeCellElement(row: number, col: number): HTMLElement {
  const el = document.createElement("button");
  el.dataset.row = String(row);
  el.dataset.col = String(col);
  return el;
}

describe("useDigitDrag", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.elementFromPoint = (() => null) as typeof document.elementFromPoint;
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
      result.current.start({
        digit: 5,
        source: { kind: "numpad" },
        x: 100,
        y: 200,
        pointerId: 1,
      });
    });
    expect(result.current.state).toEqual({
      digit: 5,
      source: { kind: "numpad" },
      x: 100,
      y: 200,
      target: null,
      invalidTarget: false,
    });
  });

  it("tracks the pointer position and updates target while moving", () => {
    mockElementFromPoint(() => makeCellElement(3, 4));
    const { result } = renderHook(() =>
      useDigitDrag({ onDrop: vi.fn(), isDroppable: () => true }),
    );
    act(() => {
      result.current.start({
        digit: 7,
        source: { kind: "numpad" },
        x: 0,
        y: 0,
        pointerId: 1,
      });
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
      result.current.start({
        digit: 1,
        source: { kind: "numpad" },
        x: 0,
        y: 0,
        pointerId: 1,
      });
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
      result.current.start({
        digit: 9,
        source: { kind: "numpad" },
        x: 0,
        y: 0,
        pointerId: 1,
      });
    });
    act(() => {
      document.dispatchEvent(
        pointerEvent("pointermove", { clientX: 50, clientY: 60 }),
      );
      document.dispatchEvent(
        pointerEvent("pointerup", { clientX: 50, clientY: 60 }),
      );
    });
    expect(onDrop).toHaveBeenCalledWith(
      9,
      { kind: "numpad" },
      { row: 5, col: 6 },
    );
    expect(result.current.state).toBeNull();
  });

  it("cancels without onDrop when released outside a cell", () => {
    mockElementFromPoint(() => null as unknown as HTMLElement);
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useDigitDrag({ onDrop, isDroppable: () => true }),
    );
    act(() => {
      result.current.start({
        digit: 4,
        source: { kind: "numpad" },
        x: 0,
        y: 0,
        pointerId: 1,
      });
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
      result.current.start({
        digit: 4,
        source: { kind: "numpad" },
        x: 0,
        y: 0,
        pointerId: 1,
      });
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
      result.current.start({
        digit: 1,
        source: { kind: "numpad" },
        x: 0,
        y: 0,
        pointerId: 1,
      });
    });
    act(() => {
      document.dispatchEvent(
        pointerEvent("pointermove", {
          pointerId: 2,
          clientX: 999,
          clientY: 999,
        }),
      );
      document.dispatchEvent(
        pointerEvent("pointerup", { pointerId: 2 }),
      );
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
      result.current.start({
        digit: 2,
        source: { kind: "numpad" },
        x: 0,
        y: 0,
        pointerId: 1,
      });
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
      result.current.start({
        digit: 3,
        source: { kind: "numpad" },
        x: 0,
        y: 0,
        pointerId: 1,
      });
    });
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(onDrop).not.toHaveBeenCalled();
    expect(result.current.state).toBeNull();
  });
});
