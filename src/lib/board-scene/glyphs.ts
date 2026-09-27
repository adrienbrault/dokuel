import { CanvasTexture, SRGBColorSpace } from "three";
import type { BoardTheme } from "./theme.ts";

const SIZE = 256;
const FONT_STACK = '"DM Sans Variable", "DM Sans", system-ui, sans-serif';

function makeCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return [canvas, ctx];
}

function makeTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Draws text centered on its ink, not on its em box. */
function centeredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
) {
  const m = ctx.measureText(text);
  const ascent = m.actualBoundingBoxAscent;
  const descent = m.actualBoundingBoxDescent;
  const left = m.actualBoundingBoxLeft;
  const right = m.actualBoundingBoxRight;
  ctx.fillText(text, x + (left - right) / 2, y + (ascent - descent) / 2);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/**
 * Canvas-drawn glyph textures for cell values. Plain and tinted digits
 * are drawn white so one texture serves every ink color through the
 * material tint; emoji keep their own colors.
 */
export class GlyphCache {
  private values = new Map<string, CanvasTexture>();

  private theme: BoardTheme;

  constructor(theme: BoardTheme) {
    this.theme = theme;
  }

  setTheme(theme: BoardTheme) {
    this.theme = theme;
    this.dispose();
  }

  value(digit: number, given: boolean): CanvasTexture {
    const mode = this.theme.digitMode;
    const key = `${mode}:${digit}:${given}`;
    const cached = this.values.get(key);
    if (cached) return cached;
    const [canvas, ctx] = makeCanvas();
    const mid = SIZE / 2;
    ctx.fillStyle = "#fff";
    if (mode === "colors") {
      const s = SIZE * 0.58;
      if (given) roundRect(ctx, mid - s / 2, mid - s / 2, s, s, SIZE * 0.08);
      else {
        ctx.beginPath();
        ctx.arc(mid, mid, s / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (mode === "emoji") {
      if (!given) {
        ctx.fillStyle = this.theme.digitEntered;
        ctx.beginPath();
        ctx.arc(mid, mid, SIZE * 0.36, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = `${SIZE * 0.46}px ${FONT_STACK}`;
      centeredText(ctx, this.theme.emoji[digit] ?? String(digit), mid, mid);
    } else {
      ctx.font = `${given ? 700 : 600} ${SIZE * 0.56}px ${FONT_STACK}`;
      centeredText(ctx, String(digit), mid, mid);
    }
    const texture = makeTexture(canvas);
    this.values.set(key, texture);
    return texture;
  }

  /** Redraws a cell's pencil notes into its own canvas texture. */
  drawNotes(texture: CanvasTexture, notes: Set<number>) {
    const canvas = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const mode = this.theme.digitMode;
    const sub = SIZE / 3;
    ctx.font = `500 ${mode === "emoji" ? sub * 0.72 : sub * 0.78}px ${FONT_STACK}`;
    for (const n of notes) {
      const x = ((n - 1) % 3) * sub + sub / 2;
      const y = Math.floor((n - 1) / 3) * sub + sub / 2;
      if (mode === "colors") {
        ctx.fillStyle = this.theme.digitHues[n] ?? "#888";
        ctx.beginPath();
        ctx.arc(x, y, sub * 0.27, 0, Math.PI * 2);
        ctx.fill();
      } else if (mode === "emoji") {
        centeredText(ctx, this.theme.emoji[n] ?? String(n), x, y);
      } else {
        ctx.fillStyle =
          mode === "digits"
            ? (this.theme.digitHues[n] ?? "#888")
            : `#${this.theme.textSecondary.getHexString(SRGBColorSpace)}`;
        centeredText(ctx, String(n), x, y);
      }
    }
    texture.needsUpdate = true;
  }

  createNotesTexture(): CanvasTexture {
    const [canvas] = makeCanvas();
    return makeTexture(canvas);
  }

  dispose() {
    for (const t of this.values.values()) t.dispose();
    this.values.clear();
  }
}
