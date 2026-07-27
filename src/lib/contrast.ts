/**
 * WCAG contrast ratios for the oklch colours in the design token layer.
 *
 * The palette is authored in oklch, whose L is perceptual lightness — not
 * the relative luminance WCAG 2.x measures. The two disagree enough that
 * "these have similar L, so they must contrast" is not a safe assumption,
 * which is how a dark-mode accent tuned to read *on* a dark page ended up
 * being used *under* white text at 2.4:1.
 */

export type Oklch = { l: number; c: number; h: number };

/** Parses `oklch(0.55 0.19 278)`, with or without a trailing `/ alpha`. */
export function parseOklch(value: string): Oklch | null {
  const match = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(value.trim());
  if (!match) return null;
  return {
    l: Number(match[1]),
    c: Number(match[2]),
    h: Number(match[3]),
  };
}

/** oklch → linear-light sRGB, clamped to gamut. */
function toLinearSrgb({ l, c, h }: Oklch): [number, number, number] {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const lCbrt = l + 0.3963377774 * a + 0.2158037573 * b;
  const mCbrt = l - 0.1055613458 * a - 0.0638541728 * b;
  const sCbrt = l - 0.0894841775 * a - 1.291485548 * b;

  const lc = lCbrt ** 3;
  const mc = mCbrt ** 3;
  const sc = sCbrt ** 3;

  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return [
    clamp(4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc),
    clamp(-1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc),
    clamp(-0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc),
  ];
}

function relativeLuminance(rgb: [number, number, number]): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

/**
 * WCAG 2.1 contrast ratio between two oklch colours, from 1 (identical)
 * to 21 (black on white). AA wants 4.5 for body text, 3 for large text
 * and for meaningful graphics.
 */
export function contrastRatio(foreground: Oklch, background: Oklch): number {
  const a = relativeLuminance(toLinearSrgb(foreground));
  const b = relativeLuminance(toLinearSrgb(background));
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}
