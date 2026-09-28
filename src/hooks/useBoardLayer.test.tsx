import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
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
let layer: ReturnType<typeof useBoardLayer>;
let build: ReturnType<typeof vi.fn>;

function Harness({
  children,
  completed,
  scene,
}: {
  children?: ReactNode;
  completed: boolean;
  scene: FakeScene | null;
}) {
  build = vi.fn((_env: SceneEnv, _hover: number | null) => snapshot);
  const buildSnapshot = build as unknown as (
    env: SceneEnv,
    hover: number | null,
  ) => SceneSnapshot;
  layer = useBoardLayer({
    enabled: true,
    boardPx: 300,
    completed,
    onSelectCell: vi.fn(),
    build: buildSnapshot,
    create: () => scene as unknown as BoardScene | null,
  });
  return (
    <div>
      <canvas ref={layer.canvasRef} data-testid="board-canvas" />
      {children}
    </div>
  );
}

function renderLayer(scene: FakeScene | null, completed: boolean) {
  const view = render(<Harness completed={completed} scene={scene} />);
  const canvas = screen.getByTestId("board-canvas");
  return {
    ...view,
    canvas,
    getScene: () => scene,
    getBuild: () => build,
    getLayer: () => layer,
    rerender: (next: { completed: boolean; scene?: FakeScene | null }) =>
      view.rerender(
        <Harness completed={next.completed} scene={next.scene ?? scene} />,
      ),
  };
}

describe("useBoardLayer", () => {
  it("celebrates once the board is complete", () => {
    const { rerender, getScene } = renderLayer(fakeScene(), false);

    rerender({ completed: true });

    expect(getScene()?.celebrate).toHaveBeenCalledTimes(1);
  });

  it("does not celebrate again while the board stays complete", () => {
    const { rerender, getScene } = renderLayer(fakeScene(), true);

    rerender({ completed: true });
    rerender({ completed: true });

    expect(getScene()?.celebrate).toHaveBeenCalledTimes(1);
  });

  it("celebrates again when a fresh board completes", () => {
    const { rerender, getScene } = renderLayer(fakeScene(), true);

    rerender({ completed: false });
    rerender({ completed: true });

    expect(getScene()?.celebrate).toHaveBeenCalledTimes(2);
  });

  it("hands the hovered cell to the snapshot builder", () => {
    const scene = fakeScene();
    scene.hitTest = vi.fn(() => ({ row: 2, col: 5, localY: 0.25 }));
    const { getLayer, getBuild } = renderLayer(scene, false);

    act(() => getLayer().pointer.onPointerMove({ clientX: 300, clientY: 120 }));

    expect(getBuild()).toHaveBeenLastCalledWith(
      expect.anything(),
      cellKey(2, 5),
    );
  });

  it("stays inert without a scene", () => {
    const { getLayer } = renderLayer(null, false);

    expect(getLayer().active).toBe(false);
  });
});
