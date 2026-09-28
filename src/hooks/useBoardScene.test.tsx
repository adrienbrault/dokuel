import { act, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { BoardScene, createBoardScene } from "../three/board-scene.ts";
import type { SceneSnapshot } from "../three/scene-state.ts";
import type { SceneEnv } from "./useBoardScene.ts";
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

const noopBuild = (): SceneSnapshot => snapshot();

let handle: ReturnType<typeof useBoardScene>;

function Harness({
  boardPx,
  build,
  create,
  enabled = true,
}: {
  boardPx: number;
  build: (env: SceneEnv) => SceneSnapshot;
  create: (..._args: Parameters<typeof createBoardScene>) => BoardScene | null;
  enabled?: boolean;
}) {
  handle = useBoardScene({ enabled, boardPx, build, create });
  return <canvas ref={handle.canvasRef} data-testid="board-canvas" />;
}

function renderHarness(
  create: (..._args: Parameters<typeof createBoardScene>) => BoardScene | null,
  props: {
    boardPx?: number;
    build?: (env: SceneEnv) => SceneSnapshot;
    enabled?: boolean;
  } = {},
) {
  return render(
    <Harness
      create={create}
      boardPx={props.boardPx ?? 300}
      build={props.build ?? noopBuild}
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
      _name: string,
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
    const create = vi.fn(
      (..._args: Parameters<typeof createBoardScene>) =>
        fakeScene() as BoardScene,
    );

    renderHarness(create, { enabled: false });

    expect(create).not.toHaveBeenCalled();
    expect(handle.active).toBe(false);
  });

  it("pushes every snapshot it is handed", () => {
    const scene = fakeScene();
    const first = snapshot();
    const { rerender } = renderHarness((..._args) => scene as BoardScene, {
      build: () => first,
    });

    const second = snapshot({ completed: true });
    rerender(
      <Harness
        create={(..._args) => scene as BoardScene}
        boardPx={300}
        build={() => second}
      />,
    );

    expect(scene.setSnapshot).toHaveBeenLastCalledWith(second);
  });

  it("builds snapshots with the digit mode and symbols in force", async () => {
    // The mode lives on the root as a data attribute, not as a prop, so
    // the snapshot has to be assembled from what the page actually says.
    const scene = fakeScene();
    const seen: SceneEnv[] = [];

    renderHarness((..._args) => scene as BoardScene, {
      build: (env) => {
        seen.push(env);
        return snapshot({ digitMode: env.digitMode });
      },
    });

    expect(seen.at(-1)).toMatchObject({
      digitMode: "off",
      reducedMotion: false,
    });
    expect(seen.at(-1)!.emoji).toHaveLength(9);

    await act(async () => {
      document.documentElement.dataset.digitColor = "colors";
    });

    expect(seen.at(-1)).toMatchObject({ digitMode: "colors" });
    expect(scene.setSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ digitMode: "colors" }),
    );
  });

  it("reframes when the board's box changes size", () => {
    const scene = fakeScene();
    const { rerender } = renderHarness((..._args) => scene as BoardScene);

    rerender(
      <Harness
        create={(..._args) => scene as BoardScene}
        boardPx={420}
        build={noopBuild}
      />,
    );

    expect(scene.resize).toHaveBeenLastCalledWith(420);
  });

  it("re-reads glyphs when the digit mode changes", async () => {
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

  it("hands the atlas its numerals while digits draw as digits", async () => {
    // An atlas of emoji has no slot for "7", so every digit would end up
    // sampling the same glyph. The atlas is built from what is drawn.
    const scene = fakeScene();
    renderHarness((..._args) => scene as BoardScene);
    scene.setGlyphs.mockClear();

    await act(async () => {
      document.documentElement.dataset.digitColor = "colors";
    });

    expect(scene.setGlyphs).toHaveBeenCalledWith(
      ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
      true,
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
    const { unmount } = renderHarness((..._args) => scene as BoardScene);

    unmount();

    expect(scene.dispose).toHaveBeenCalledTimes(1);
  });

  it("hands the caller the snapshot it built", () => {
    // The painted grid is the scene's twin, so it has to paint from the
    // very same derivation rather than a second one of its own.
    const built = snapshot({ digitMode: "digits" });
    const { result } = renderHook(() =>
      useBoardScene({
        enabled: false,
        boardPx: 300,
        build: () => built,
        create: (..._args) => null,
      }),
    );

    expect(result.current.snapshot).toBe(built);
  });

  it("reports the environment a disabled board still needs", () => {
    const { result } = renderHook(() =>
      useBoardScene({
        enabled: false,
        boardPx: 300,
        build: noopBuild,
        create: (..._args) => null,
      }),
    );

    expect(result.current.digitMode).toBe("off");
    expect(result.current.emoji).toHaveLength(9);
  });
});
