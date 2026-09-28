import { type RefObject, useEffect, useRef, useState } from "react";
import type { DigitColorMode } from "../lib/types.ts";
import { type BoardScene, createBoardScene } from "../three/board-scene.ts";
import {
  createPaletteReader,
  readEmojiSymbols,
  readPalette,
} from "../three/palette.ts";
import type { SceneSnapshot } from "../three/scene-state.ts";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const MODES: readonly string[] = ["off", "digits", "colors", "emoji"];

/**
 * One reader for every board on the page.
 *
 * It resolves design tokens through a single invisible probe, so several
 * boards — a solo game and a replay, say — read the same palette without
 * each carrying their own element.
 */
const read = createPaletteReader();

/** How the scene gets built. Stands in for WebGL where there is none. */
export type SceneFactory = typeof createBoardScene;

export type BoardSceneHandle = {
  /** Attach to the canvas the scene paints into. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** The live scene, or null while the painted grid stands in. */
  scene: BoardScene | null;
  /** True when the scene is live and the DOM paint should step aside. */
  active: boolean;
  /** Current digit palette mode, read off the document root. */
  digitMode: DigitColorMode;
  /** Nine emoji symbols indexed by digit - 1. */
  emoji: string[];
  /** True when the player has asked the page not to move. */
  reducedMotion: boolean;
};

export type BoardSceneOptions = {
  /** False for a paper board, which stays a flat printed sheet. */
  enabled: boolean;
  /** The board's CSS box, in pixels, which the camera frames to. */
  boardPx: number;
  /** Every cell's visual state, pushed to the scene as it changes. */
  snapshot: SceneSnapshot;
  create?: SceneFactory;
};

function readDigitMode(): DigitColorMode {
  const raw = document.documentElement.dataset.digitColor;
  return MODES.includes(raw ?? "") ? (raw as DigitColorMode) : "off";
}

function readReducedMotion(): boolean {
  return window.matchMedia?.(REDUCED_MOTION).matches ?? false;
}

function sameSymbols(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((symbol, i) => symbol === b[i]);
}

/**
 * Owns the WebGL board for one mounted grid.
 *
 * The scene is built once, against the board's own canvas, and then fed
 * rather than rebuilt: a new snapshot, a resize, a theme flip or a
 * motion preference all travel into the same scene, because rebuilding
 * eighty-one tiles to change a colour would drop frames for nothing.
 *
 * The digit mode and emoji theme are not props — they live on the
 * document root, painted there by their own hooks so all eighty-one
 * cells repaint from one attribute. This hook watches that root, so the
 * scene follows the same signal the CSS does.
 *
 * Where WebGL or a 2D canvas is missing, `active` stays false and the
 * painted grid keeps doing its job.
 */
export function useBoardScene({
  enabled,
  boardPx,
  snapshot,
  create = createBoardScene,
}: BoardSceneOptions): BoardSceneHandle {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<BoardScene | null>(null);
  const [active, setActive] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(readReducedMotion);
  const [digitMode, setDigitMode] = useState(readDigitMode);
  const [emoji, setEmoji] = useState(() => readEmojiSymbols(read));

  // The freshest environment facts, for callbacks that outlive the render
  // that queued them — the font settling in, say.
  const latest = useRef({ digitMode, reducedMotion });
  useEffect(() => {
    latest.current = { digitMode, reducedMotion };
  }, [digitMode, reducedMotion]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the scene is built once per mount; later changes to size, mode and motion are pushed into it by the effects below rather than rebuilding it
  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = create(canvas, readPalette(read), readEmojiSymbols(read), {
      mono: digitMode !== "emoji",
      boardPx,
      reducedMotion,
    });
    sceneRef.current = scene;
    if (!scene) {
      setActive(false);
      return () => {
        sceneRef.current = null;
      };
    }

    scene.setSnapshot(snapshot);
    setActive(true);

    // The numerals are self-hosted and can land after the first atlas was
    // baked, which would leave it drawn in a fallback face.
    document.fonts?.ready.then(() => {
      if (sceneRef.current !== scene) return;
      scene.setGlyphs(
        readEmojiSymbols(read),
        latest.current.digitMode !== "emoji",
      );
    });

    return () => {
      scene.dispose();
      sceneRef.current = null;
      setActive(false);
    };
  }, [enabled, create]);

  // Nothing here waits on `active`: the scene already arrives sized,
  // moving and painted the way this render describes it, so these effects
  // only have to notice a change after that.
  useEffect(() => {
    sceneRef.current?.setSnapshot(snapshot);
  }, [snapshot]);

  useEffect(() => {
    sceneRef.current?.resize(boardPx);
  }, [boardPx]);

  useEffect(() => {
    sceneRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    const mq = window.matchMedia?.(REDUCED_MOTION);
    if (!mq) return;
    const onChange = (event: MediaQueryListEvent) =>
      setReducedMotion(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // The theme, digit mode and emoji theme all announce themselves as an
  // attribute or a custom property on the root, so that is what to watch.
  useEffect(() => {
    const onRootChange = () => {
      const mode = readDigitMode();
      const symbols = readEmojiSymbols(read);
      const scene = sceneRef.current;
      scene?.setPalette(readPalette(read));
      scene?.setGlyphs(symbols, mode !== "emoji");
      setDigitMode((current) => (current === mode ? current : mode));
      setEmoji((current) =>
        sameSymbols(current, symbols) ? current : symbols,
      );
    };
    const observer =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(onRootChange);
    observer?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-digit-color"],
    });
    return () => observer?.disconnect();
  }, []);

  return {
    canvasRef,
    scene: sceneRef.current,
    active,
    digitMode,
    emoji,
    reducedMotion,
  };
}
