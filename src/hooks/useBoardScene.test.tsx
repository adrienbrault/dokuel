import { act, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { BoardScene, createBoardScene } from "../three/board-scene.ts";
import type { SceneSnapshot } from "../three/scene-state.ts";
import { useBoardScene } from "./useBoardScene.ts";

function snapshot(over: Partial<SceneSnapshot> = {}): SceneSnapshot {
  return {
    cells: [],
    digitMode: "off",
    completed: false,
    reducedMotion: false,
    ...over,
  };
}

type FakeScene = { [K in keyof BoardScene]: Mock };

function fakeScene(): FakeScene {
  return {
    setSnapshot: vi.fn(),
    setPalette: vi.fn(),
    setGlyphs: vi.fn(),
    setPointer: vi.fn(),
    hitTest: vi.fn(() => null) as unknown as Mock,
    resize: vi.fn(),
    setReducedMotion: vi.fn(),
    pulseCell: vi.fn(),
    sparkCell: vi.fn(),
    celebrate: vi.fn(),
    dispose: vi.fn(),
  };
}

let handle: ReturnType<typeof useBoardScene>;

function Harness({
  boardPx,
  snapshot: snap,
  create,
  enabled = true,
}: {
  boardPx: number;
  snapshot: SceneSnapshot;
  create: (..._args: Parameters<typeof createBoardScene>) => BoardScene | null;
  enabled?: boolean;
}) {
  handle = useBoardScene({ enabled, boardPx, snapshot: snap, create });
  return <canvas ref={handle.canvasRef} data-testid="board-canvas" />;
}

function renderHarness(
  create: (..._args: Parameters<typeof createBoardScene>) => BoardScene | null,
  props: { boardPx?: number; snapshot?: SceneSnapshot; enabled?: boolean } = {},
) {
  return render(
    <Harness
      create={create}
      boardPx={props.boardPx ?? 300}
      snapshot={props.snapshot ?? snapshot()}
      enabled={props.enabled ?? true}
    />,
  );
}

/** A matchMedia the test can flip, since jsdom ships only a dead stub. */
function stubReducedMotion(matches: boolean) {
  const listeners = new Set<(event: { matches: boolean }) => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: (_: string, fn: (event: { matches: boolean }) => void) =>
      listeners.add(fn),
    removeEventListener: (
      _: string,
      fn: (event: { matches: boolean }) => void,
    ) => listeners.delete(fn),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
  return {
    set(next: boolean) {
      for (const fn of listeners) fn({ matches: next });
    },
  };
}

beforeEach(() => {
  delete document.documentElement.dataset.digitColor;
  document.documentElement.classList.remove("dark");
  document.documentElement.style.removeProperty("--digit-emoji-1");
  vi.unstubAllGlobals();
});

describe("useBoardScene", () => {
  it("builds the scene against the canvas it is given", () => {
    const scene = fakeScene();
    const create = vi.fn(
      (..._args: Parameters<typeof createBoardScene>) => scene as BoardScene,
    );

    renderHarness(create);

    expect(create).toHaveBeenCalledTimes(1);
    const [canvas] = create.mock.calls[0]!;
    expect(canvas).toBe(screen.getByTestId("board-canvas"));
    expect(handle.active).toBe(true);
  });

  it("keeps the DOM board where the scene cannot build", () => {
    // No WebGL, or no 2D canvas: the painted grid has to stay.
    renderHarness((..._args) => null);

    expect(handle.active).toBe(false);
    expect(handle.scene).toBeNull();
  });

  it("leaves a paper board alone", () => {
    // Paper is a flat sheet to print, not an object to light.
    const create = vi.fn(() => fakeScene() as BoardScene);

    renderHarness(create, { enabled: false });

    expect(create).not.toHaveBeenCalled();
    expect(handle.active).toBe(false);
  });

  it("pushes every snapshot it is handed", () => {
    const scene = fakeScene();
    const first = snapshot();
    const { rerender } = renderHarness(() => scene as BoardScene, {
      snapshot: first,
    });

    const second = snapshot({ completed: true });
    rerender(
      <Harness
        create={(..._args) => scene as BoardScene}
        boardPx={300}
        snapshot={second}
      />,
    );

    expect(scene.setSnapshot).toHaveBeenLastCalledWith(second);
  });

  it("reframes when the board's box changes size", () => {
    const scene = fakeScene();
    const { rerender } = renderHarness(() => scene as BoardScene);

    rerender(
      <Harness
        create={(..._args) => scene as BoardScene}
        boardPx={420}
        snapshot={snapshot()}
      />,
    );

    expect(scene.resize).toHaveBeenLastCalledWith(420);
  });

  it("re-reads colours and glyphs when the digit mode changes", async () => {
    // The mode lives on the root as a data attribute, not as a prop.
    const scene = fakeScene();
    renderHarness((..._args) => scene as BoardScene);
    scene.setPalette.mockClear();
    scene.setGlyphs.mockClear();

    await act(async () => {
      document.documentElement.dataset.digitColor = "emoji";
    });

    expect(scene.setPalette).toHaveBeenCalled();
    expect(scene.setGlyphs).toHaveBeenCalledWith(
      expect.arrayContaining([expect.any(String)]),
      false,
    );
  });

  it("re-reads colours when the theme flips", async () => {
    const scene = fakeScene();
    renderHarness((..._args) => scene as BoardScene);
    scene.setPalette.mockClear();

    await act(async () => {
      document.documentElement.classList.add("dark");
    });

    expect(scene.setPalette).toHaveBeenCalled();
  });

  it("tells the scene when reduced motion turns on", () => {
    const mq = stubReducedMotion(false);
    const scene = fakeScene();
    renderHarness((..._args) => scene as BoardScene);

    act(() => mq.set(true));

    expect(handle.reducedMotion).toBe(true);
    expect(scene.setReducedMotion).toHaveBeenLastCalledWith(true);
  });

  it("releases the scene when the board goes away", () => {
    // A page that mounts and unmounts boards must not leak contexts.
    const scene = fakeScene();
    const { unmount } = renderHarness(() => scene as BoardScene);

    unmount();

    expect(scene.dispose).toHaveBeenCalledTimes(1);
  });

  it("reports the digit mode and symbols the snapshot needs", () => {
    const { result } = renderHook(() =>
      useBoardScene({
        enabled: false,
        boardPx: 300,
        snapshot: snapshot(),
        create: (..._args) => null,
      }),
    );

    expect(result.current.digitMode).toBe("off");
    expect(result.current.emoji).toHaveLength(9);
  });
});
