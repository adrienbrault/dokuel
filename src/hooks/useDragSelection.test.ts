import { describe, expect, it, mock } from "bun:test";
import { renderHook } from "@testing-library/react";
import { cellKey } from "../lib/sudoku.ts";
import { useDragSelection } from "./useDragSelection.ts";

function makePointerEvent(
  type: string,
  opts: { clientX?: number; clientY?: number; shiftKey?: boolean } = {},
): PointerEvent {
  return new PointerEvent(type, {
    clientX: opts.clientX ?? 0,
    clientY: opts.clientY ?? 0,
    shiftKey: opts.shiftKey ?? false,
    bubbles: true,
  });
}

function makeMouseEvent(): MouseEvent {
  return new MouseEvent("click", { bubbles: true });
}

/**
 * Set up a minimal DOM element at (x, y) so getCellFromPoint can resolve it.
 * Returns the element and a cleanup function.
 */
function setupCellElement(row: number, col: number): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.dataset.row = String(row);
  btn.dataset.col = String(col);
  document.body.appendChild(btn);
  // Make elementFromPoint return our button
  // jsdom doesn't implement elementFromPoint; we stub it
  return btn;
}

describe("useDragSelection", () => {
  it("handleClick does nothing when suppressClick is not set", () => {
    const onSetSelectedCells = mock(() => {});
    const { result } = renderHook(() =>
      useDragSelection({
        onSetSelectedCells,
        selectedCells: undefined,
        selectedCell: null,
      }),
    );

    const e = makeMouseEvent() as unknown as React.MouseEvent<HTMLDivElement>;
    // Should not throw
    result.current.handleClick(e);
    expect(onSetSelectedCells).not.toHaveBeenCalled();
  });

  it("handlePointerDown with no matching element does not call onSetSelectedCells", () => {
    const onSetSelectedCells = mock(() => {});
    const { result } = renderHook(() =>
      useDragSelection({
        onSetSelectedCells,
        selectedCells: undefined,
        selectedCell: null,
      }),
    );

    // elementFromPoint returns null in jsdom — no element at (0,0)
    const e = makePointerEvent("pointerdown", { clientX: 0, clientY: 0 });
    result.current.handlePointerDown(
      e as unknown as React.PointerEvent<HTMLDivElement>,
    );
    expect(onSetSelectedCells).not.toHaveBeenCalled();
  });

  it("handlePointerUp without prior pointerdown does nothing", () => {
    const onSetSelectedCells = mock(() => {});
    const { result } = renderHook(() =>
      useDragSelection({
        onSetSelectedCells,
        selectedCells: undefined,
        selectedCell: null,
      }),
    );

    const e = makePointerEvent("pointerup");
    result.current.handlePointerUp(
      e as unknown as React.PointerEvent<HTMLDivElement>,
    );
    expect(onSetSelectedCells).not.toHaveBeenCalled();
  });

  it("shift+click merges with existing selection", () => {
    const onSetSelectedCells = mock(() => {});
    const existingKey = cellKey(0, 0);
    const existingCells = new Set([existingKey]);

    // Stub elementFromPoint to return a cell element at (5,5)
    const btn = setupCellElement(1, 1);
    const originalFromPoint = document.elementFromPoint.bind(document);
    document.elementFromPoint = (_x: number, _y: number) => btn;

    const { result } = renderHook(() =>
      useDragSelection({
        onSetSelectedCells,
        selectedCells: existingCells,
        selectedCell: { row: 0, col: 0 },
      }),
    );

    const e = makePointerEvent("pointerdown", { shiftKey: true });
    result.current.handlePointerDown(
      e as unknown as React.PointerEvent<HTMLDivElement>,
    );

    expect(onSetSelectedCells).toHaveBeenCalledTimes(1);
    const [calledCells] = onSetSelectedCells.mock.calls[0]!;
    expect((calledCells as Set<number>).has(existingKey)).toBe(true);
    expect((calledCells as Set<number>).has(cellKey(1, 1))).toBe(true);

    document.elementFromPoint = originalFromPoint;
    document.body.removeChild(btn);
  });

  it("handlePointerMove accumulates cells during drag", () => {
    const onSetSelectedCells = mock(() => {});
    const btn0 = setupCellElement(0, 0);
    const btn1 = setupCellElement(0, 1);

    const originalFromPoint = document.elementFromPoint.bind(document);
    let callCount = 0;
    document.elementFromPoint = (_x: number, _y: number) => {
      return callCount++ === 0 ? btn0 : btn1;
    };

    const { result } = renderHook(() =>
      useDragSelection({
        onSetSelectedCells,
        selectedCells: undefined,
        selectedCell: null,
      }),
    );

    // Start drag at cell (0,0)
    result.current.handlePointerDown(
      makePointerEvent(
        "pointerdown",
      ) as unknown as React.PointerEvent<HTMLDivElement>,
    );

    // Move to cell (0,1)
    result.current.handlePointerMove(
      makePointerEvent(
        "pointermove",
      ) as unknown as React.PointerEvent<HTMLDivElement>,
    );

    expect(onSetSelectedCells).toHaveBeenCalledTimes(1);
    const [calledCells] = onSetSelectedCells.mock.calls[0]!;
    expect((calledCells as Set<number>).has(cellKey(0, 0))).toBe(true);
    expect((calledCells as Set<number>).has(cellKey(0, 1))).toBe(true);

    document.elementFromPoint = originalFromPoint;
    document.body.removeChild(btn0);
    document.body.removeChild(btn1);
  });
});
