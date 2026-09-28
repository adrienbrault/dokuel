import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { cellKey } from "../lib/sudoku.ts";
import type { BoardScene } from "../three/board-scene.ts";
import { useBoardPointer } from "./useBoardPointer.ts";

function fakeScene(hit: { row: number; col: number } | null) {
  const scene = {
    setPointer: vi.fn(),
    // A pointer past 600px is off the board, so the scene reports a miss.
    hitTest: vi.fn((x: number, _y: number) =>
      hit && x <= 600 ? { row: hit.row, col: hit.col, localY: 0.25 } : null,
    ),
  };
  return scene as unknown as BoardScene;
}

function renderPointer(
  hit: { row: number; col: number } | null,
  active = true,
) {
  const onSelectCell = vi.fn();
  const scene = fakeScene(hit);
  let renders = 0;
  const view = renderHook(
    ({ on }: { on: (row: number, col: number) => void }) => {
      renders += 1;
      return useBoardPointer(scene, active, on);
    },
    { initialProps: { on: onSelectCell } },
  );
  return { ...view, scene, onSelectCell, renderCount: () => renders };
}

describe("useBoardPointer", () => {
  it("reports the hovered cell and feeds the scene the pointer", () => {
    const { result, scene } = renderPointer({ row: 2, col: 5 });

    act(() => result.current.onPointerMove({ clientX: 300, clientY: 120 }));

    expect(result.current.hover).toBe(cellKey(2, 5));
    expect(scene.setPointer).toHaveBeenLastCalledWith(300, 120);
  });

  it("clears the hover where the pointer misses the board", () => {
    const { result, scene } = renderPointer({ row: 2, col: 5 });

    act(() => result.current.onPointerMove({ clientX: 300, clientY: 120 }));
    act(() => result.current.onPointerMove({ clientX: 900, clientY: 900 }));

    expect(result.current.hover).toBeNull();
    expect(scene.setPointer).toHaveBeenLastCalledWith(900, 900);
  });

  it("does not re-render while the pointer stays on one cell", () => {
    // Eighty-one tiles repaint off this state, so a move within the same
    // cell must not ask React to render the board again.
    const { result, renderCount } = renderPointer({ row: 2, col: 5 });

    act(() => result.current.onPointerMove({ clientX: 300, clientY: 120 }));
    const renders = renderCount();
    act(() => result.current.onPointerMove({ clientX: 305, clientY: 124 }));

    expect(renderCount()).toBe(renders);
  });

  it("puts the pointer away when it leaves", () => {
    const { result, scene } = renderPointer({ row: 2, col: 5 });

    act(() => result.current.onPointerMove({ clientX: 300, clientY: 120 }));
    act(() => result.current.onPointerLeave());

    expect(result.current.hover).toBeNull();
    expect(scene.setPointer).toHaveBeenLastCalledWith(null, null);
  });

  it("selects the cell under a click while the scene is painting", () => {
    const { result, onSelectCell } = renderPointer({ row: 6, col: 1 });

    act(() => result.current.onPointerDown({ clientX: 300, clientY: 120 }));

    expect(onSelectCell).toHaveBeenCalledWith(6, 1);
  });

  it("leaves the click to the painted cells when there is no scene", () => {
    const { result, onSelectCell, scene } = renderPointer(
      { row: 6, col: 1 },
      false,
    );

    act(() => result.current.onPointerDown({ clientX: 300, clientY: 120 }));

    expect(onSelectCell).not.toHaveBeenCalled();
    expect(scene.setPointer).not.toHaveBeenCalled();
  });
});
