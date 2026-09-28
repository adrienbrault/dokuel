import { Color } from "three";
import { EMOJI_THEMES } from "../lib/emoji-themes.ts";

/** Reads one custom property (or any CSS value) as a raw string. */
export type PaletteReader = (name: string) => string;

/** `[r, g, b]` in 0..1 linear-ish sRGB, as Three consumes it. */
export type Rgb = [number, number, number];

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** sRGB transfer function, for values arriving in a linear space. */
const gammaEncode = (c: number) =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;

/**
 * Oklab / Oklch to sRGB, following Björn Ottosson's reference matrices.
 * The design tokens are authored in oklch, and a browser asked to
 * resolve one through a legacy path can hand the raw function back.
 */
function oklchToRgb(l: number, c: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;
  return [
    clamp01(
      gammaEncode(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
    ),
    clamp01(
      gammaEncode(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
    ),
    clamp01(
      gammaEncode(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3),
    ),
  ];
}

function oklabToRgb(l: number, a: number, b: number): Rgb {
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;
  return [
    clamp01(
      gammaEncode(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
    ),
    clamp01(
      gammaEncode(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
    ),
    clamp01(
      gammaEncode(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3),
    ),
  ];
}

const numbers = (value: string) =>
  value
    .replace(/[(),]/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.trim());

function isPercentage(part: string) {
  return part.endsWith("%");
}

/**
 * Resolves a CSS colour to three sRGB channels, or null when the string
 * is something the scene cannot use (an unresolved var(), a keyword).
 * Handles the forms a computed style actually returns plus the oklch the
 * tokens are written in.
 */
export function parseCssColor(value: string): Rgb | null {
  const raw = value.trim().toLowerCase();
  if (!raw) return null;

  if (raw.startsWith("#")) {
    const hex = raw.slice(1);
    if (hex.length === 3) {
      const parts = hex.split("").map((c) => parseInt(c + c, 16));
      if (parts.some((n) => Number.isNaN(n))) return null;
      return parts.map((n) => n / 255) as Rgb;
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].some((n) => Number.isNaN(n))) return null;
      return [r / 255, g / 255, b / 255];
    }
    return null;
  }

  const fn = /^([a-z-]+)\((.*)\)$/.exec(raw);
  if (!fn) return null;
  const name = fn[1]!;
  const args = numbers(fn[2]!);
  // Strip a slash-separated alpha channel: the scene paints opaque.
  const slash = args.indexOf("/");
  const parts = slash === -1 ? args : args.slice(0, slash);

  const numberArg = (part: string, scale: number) => {
    if (isPercentage(part)) return Number.parseFloat(part) / 100;
    const n = Number.parseFloat(part);
    return Number.isNaN(n) ? null : n * scale;
  };

  if (name === "rgb" || name === "rgba") {
    if (parts.length < 3) return null;
    const out: number[] = [];
    for (const part of parts.slice(0, 3)) {
      const channel = numberArg(part, 1 / 255);
      if (channel === null) return null;
      out.push(clamp01(channel));
    }
    return out as Rgb;
  }

  if (name === "hsl" || name === "hsla") {
    if (parts.length < 3) return null;
    const h = Number.parseFloat(parts[0]!);
    const s = Number.parseFloat(parts[1]!) / 100;
    const l = Number.parseFloat(parts[2]!) / 100;
    if ([h, s, l].some((n) => Number.isNaN(n))) return null;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) =>
      l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [clamp01(f(0)), clamp01(f(8)), clamp01(f(4))];
  }

  if (name === "color") {
    const space = parts[0];
    const channels = parts.slice(1, 4).map((p) => Number.parseFloat(p));
    if (channels.length !== 3 || channels.some((n) => Number.isNaN(n))) {
      return null;
    }
    if (space === "srgb") return channels.map(clamp01) as Rgb;
    if (space === "srgb-linear")
      return channels.map((c) => clamp01(gammaEncode(c))) as Rgb;
    return null;
  }

  if (name === "oklch") {
    const l = Number.parseFloat(parts[0]!);
    const c = Number.parseFloat(parts[1]!);
    const h = Number.parseFloat(parts[2]!);
    if ([l, c, h].some((n) => Number.isNaN(n))) return null;
    return oklchToRgb(l, c, h);
  }

  if (name === "oklab") {
    const l = Number.parseFloat(parts[0]!);
    const a = Number.parseFloat(parts[1]!);
    const b = Number.parseFloat(parts[2]!);
    if ([l, a, b].some((n) => Number.isNaN(n))) return null;
    return oklabToRgb(l, a, b);
  }

  return null;
}

/**
 * A reader that asks the browser to resolve a token for us.
 *
 * The tokens are written in oklch, which Three's colour parser does not
 * know, and getComputedStyle hands back whatever was specified. Pushing
 * the value through a no-op color-mix is what forces the browser to
 * compute it into a real rgb triple we can read off the probe.
 *
 * The probe hangs off body, so it inherits whatever theme class sits on
 * the root — a dark-mode flip needs no re-plumbing, just a re-read.
 */
export function createPaletteReader(): PaletteReader {
  return (name: string) => {
    const probe = paletteProbe();
    probe.style.color = "";
    probe.style.color = `color-mix(in srgb, var(${name}, rgb(0 0 0)) 100%, rgb(0 0 0) 0%)`;
    return getComputedStyle(probe).color;
  };
}

/**
 * One probe for the whole page.
 *
 * The tokens are global, so a second span resolves exactly what the
 * first does — and a page that mounts and unmounts boards would
 * otherwise strand an invisible span behind every scene it builds.
 */
let probe: HTMLElement | null = null;

function paletteProbe(): HTMLElement {
  if (!probe) {
    const span = document.createElement("span");
    span.setAttribute("aria-hidden", "true");
    span.style.position = "absolute";
    span.style.opacity = "0";
    span.style.pointerEvents = "none";
    document.body.appendChild(span);
    probe = span;
  }
  return probe;
}

/** The scene's colour surface, one entry per thing it paints. */
export type BoardPalette = {
  page: Color;
  slab: Color;
  cell: Color;
  selected: Color;
  highlight: Color;
  same: Color;
  band: Color;
  hint: Color;
  conflictBg: Color;
  conflict: Color;
  given: Color;
  user: Color;
  accent: Color;
  accentBright: Color;
  enteredDisc: Color;
  /** Pencil notes: the DOM grid paints them with secondary text. */
  note: Color;
  /** Indexed by digit - 1. */
  digits: Color[];
};

const TOKENS = {
  page: "--color-bg-primary",
  slab: "--color-board-border",
  cell: "--color-cell-bg",
  selected: "--color-cell-selected",
  highlight: "--color-cell-highlight",
  same: "--color-cell-same-number",
  band: "--color-cell-match-row-col",
  hint: "--color-cell-hint",
  conflictBg: "--color-cell-conflict-bg",
  conflict: "--color-cell-conflict",
  given: "--color-cell-given",
  user: "--color-cell-user",
  accent: "--color-accent",
  accentBright: "--color-accent-bright",
  enteredDisc: "--color-digit-entered",
  note: "--color-text-secondary",
} as const;

/**
 * Only used where the tokens cannot be read at all — a headless test
 * environment, or a browser without color-mix. A real browser resolves
 * every token, so these never reach a player's screen.
 */
const FALLBACKS: Record<keyof typeof TOKENS, number> = {
  page: 0xf7f6f4,
  slab: 0x57554f,
  cell: 0xfdfdfc,
  selected: 0xd7ece2,
  highlight: 0xe6f0eb,
  same: 0xcde5da,
  band: 0xf0f5f2,
  hint: 0xf0e6cd,
  conflictBg: 0xf3e0dc,
  conflict: 0xb04a3a,
  given: 0x3d3b38,
  user: 0x2f7a5f,
  accent: 0x3f7a63,
  accentBright: 0x4f9a7d,
  enteredDisc: 0xd9ece4,
  note: 0x6f6d68,
};

function toColor(read: PaletteReader, token: string, fallback: number): Color {
  const parsed = parseCssColor(read(token));
  return parsed
    ? new Color(parsed[0], parsed[1], parsed[2])
    : new Color(fallback);
}

/**
 * Reads the whole design-token palette for the current theme. Called on
 * mount and again whenever dark mode flips, so the WebGL board always
 * matches the surrounding page instead of a hard-coded twin of it.
 */
export function readPalette(read: PaletteReader): BoardPalette {
  const palette = {} as BoardPalette;
  for (const key of Object.keys(TOKENS) as (keyof typeof TOKENS)[]) {
    palette[key] = toColor(read, TOKENS[key], FALLBACKS[key]);
  }
  palette.digits = [];
  for (let digit = 1; digit <= 9; digit++) {
    palette.digits.push(
      toColor(read, `--color-digit-${digit}`, FALLBACKS.accent),
    );
  }
  return palette;
}

/**
 * Reads the emoji theme the page published. The custom properties are
 * quoted strings, so the quotes come off here. Falls back to the default
 * theme when nothing has been written yet.
 */
export function readEmojiSymbols(read: PaletteReader): string[] {
  const symbols: string[] = [];
  for (let digit = 1; digit <= 9; digit++) {
    const raw = read(`--digit-emoji-${digit}`).trim();
    const unquoted = raw.replace(/^["']|["']$/g, "");
    symbols.push(unquoted || (EMOJI_THEMES[0]!.symbols[digit - 1] ?? "?"));
  }
  return symbols;
}
