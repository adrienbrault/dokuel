import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { cellKey } from "../lib/sudoku.ts";
import type { BoardScene } from "../three/board-scene.ts";
import type { SceneSnapshot } from "../three/scene-state.ts";
import { useBoardLayer } from "./useBoardLayer.ts";
import type { SceneEnv } from "./useBoardScene.ts";

type FakeScene = { [K in keyof BoardScene]: ReturnType<typeof vi.fn> };

function fakeScene(): FakeScene {
  return {
    setSnapshot: vi.fn(),
    setPalette: vi.fn(),
    setGlyphs: vi.fn(),
    setPointer: vi.fn(),
    hitTest: vi.fn(() => null),
    resize: vi.fn(),
    setReducedMotion: vi.fn(),
    pulseCell: vi.fn(),
    sparkCell: vi.fn(),
    celebrate: vi.fn(),
    dispose: vi.fn(),
  } as unknown as FakeScene;
}

const snapshot = { cells: [] } as unknown as SceneSnapshot;

function renderLayer(scene: FakeScene | null, completed: boolean) {
  const onSelectCell = vi.fn();
  const build = vi.fn(() => snapshot);
  const view = renderHook(
    ({ done }: { done: boolean }) =>
      useBoardLayer({
        enabled: true,
        boardPx: 300,
        completed: done,
        onSelectCell,
        build: (_env: SceneEnv, _hover: number | null) => build(),
        create: () => scene as unknown as BoardScene | null,
      }),
    { initialProps: { done: completed } },
  );
  return { ...view, scene, build, onSelectCell };
}

describe("useBoardLayer", () => {
  it("celebrates once the board is complete", () => {
    const scene = fakeScene();
    const { rerender } = renderLayer(scene, false);

    rerender({ done: true });

    expect(scene.celebrate).toHaveBeenCalledTimes(1);
  });

  it("does not celebrate again while the board stays complete", () => {
    const scene = fakeScene();
    const { rerender } = renderLayer(scene, true);

    rerender({ done: true });
    rerender({ done: true });

    expect(scene.celebrate).toHaveBeenCalledTimes(1);
  });

  it("celebrates again when a fresh board completes", () => {
    const scene = fakeScene();
    const { rerender } = renderLayer(scene, true);

    rerender({ done: false });
    rerender({ done: true });

    expect(scene.celebrate).toHaveBeenCalledTimes(2);
  });

  it("hands the hovered cell to the snapshot builder", () => {
    const scene = fakeScene();
    scene.hitTest = vi.fn(() => ({ row: 2, col: 5, localY: 0.25 }));
    const { result, build } = renderLayer(scene, false);

    act(() =>
      result.current.pointer.onPointerMove({ clientX: 300, clientY: 120 }),
    );

    expect(build).toHaveBeenLastCalledWith(expect.anything(), cellKey(2, 5));
  });

  it("stays inert without a scene", () => {
    const { result } = renderLayer(null, false);

    expect(result.current.active).toBe(false);
  });
});
