import { Color, SRGBColorSpace } from "three";
import type { DigitColorMode } from "../types.ts";

/**
 * The board palette resolved from the CSS design tokens, so the WebGL
 * board follows dark mode and the digit palette exactly like the DOM
 * board does. Tokens are oklch; a 2D canvas parses any CSS color the
 * browser understands, which three.js's own parser does not.
 */
export type BoardTheme = {
  isDark: boolean;
  digitMode: DigitColorMode;
  cellBg: Color;
  selected: Color;
  highlight: Color;
  sameNumber: Color;
  matchRowCol: Color;
  given: Color;
  user: Color;
  conflict: Color;
  conflictBg: Color;
  hint: Color;
  accent: Color;
  accentBright: Color;
  boardBorder: Color;
  borderDefault: Color;
  textSecondary: Color;
  digitEntered: string;
  /** CSS strings for canvas drawing, index 1-9. */
  digitHues: string[];
  digitColors: Color[];
  emoji: string[];
};

let probe: CanvasRenderingContext2D | null = null;

function toRgb(css: string): [number, number, number] {
  if (!probe) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    probe = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (!probe) return [0, 0, 0];
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return [r ?? 0, g ?? 0, b ?? 0];
}

function color(css: string): Color {
  const [r, g, b] = toRgb(css);
  return new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
}

export function cssColor(c: Color): string {
  return `#${c.getHexString(SRGBColorSpace)}`;
}

export function readBoardTheme(): BoardTheme {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const c = (name: string) => color(token(`--color-${name}`));
  const mode = root.dataset.digitColor;
  const digitHues = Array.from({ length: 10 }, (_, d) =>
    d === 0 ? "" : token(`--color-digit-${d}`),
  );
  return {
    isDark: root.classList.contains("dark"),
    digitMode:
      mode === "digits" || mode === "colors" || mode === "emoji" ? mode : "off",
    cellBg: c("cell-bg"),
    selected: c("cell-selected"),
    highlight: c("cell-highlight"),
    sameNumber: c("cell-same-number"),
    matchRowCol: c("cell-match-row-col"),
    given: c("cell-given"),
    user: c("cell-user"),
    conflict: c("cell-conflict"),
    conflictBg: c("cell-conflict-bg"),
    hint: c("cell-hint"),
    accent: c("accent"),
    accentBright: c("accent-bright"),
    boardBorder: c("board-border"),
    borderDefault: c("border-default"),
    textSecondary: c("text-secondary"),
    digitEntered: token("--color-digit-entered"),
    digitHues,
    digitColors: digitHues.map((h) => (h ? color(h) : new Color())),
    emoji: Array.from({ length: 10 }, (_, d) =>
      d === 0 ? "" : token(`--digit-emoji-${d}`).replace(/^"|"$/g, ""),
    ),
  };
}
