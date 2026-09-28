import {
  CanvasTexture,
  LinearFilter,
  PlaneGeometry,
  SRGBColorSpace,
} from "three";

/** One glyph's slot inside an atlas, in UV space. */
export type GlyphRect = { u0: number; u1: number; v0: number; v1: number };

/**
 * Slots for `count` glyphs on a grid of `cols` columns, filled left to
 * right, top to bottom.
 *
 * V is flipped because a canvas texture uploads its first pixel row —
 * the top of the drawing — at v = 0 once flipY is applied, so the first
 * row of glyphs has to claim the top of the texture.
 */
export function glyphRects(count: number, cols: number): GlyphRect[] {
  const rows = Math.max(1, Math.ceil(count / cols));
  const rects: GlyphRect[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    rects.push({
      u0: col / cols,
      u1: (col + 1) / cols,
      v0: (rows - row - 1) / rows,
      v1: (rows - row) / rows,
    });
  }
  return rects;
}

/**
 * Rewrites a plane's UVs so it samples exactly one atlas slot.
 *
 * Mutates in place: every glyph keeps its own geometry, so a mesh never
 * shares UVs with a neighbour and no shader uniform is needed to pick a
 * cell out of the atlas.
 */
export function remapPlaneUvs(geometry: PlaneGeometry, rect: GlyphRect): void {
  const uv = geometry.attributes.uv!;
  const spanU = rect.u1 - rect.u0;
  const spanV = rect.v1 - rect.v0;
  const array = uv.array as Float32Array;
  for (let i = 0; i < array.length; i += 2) {
    array[i] = rect.u0 + array[i]! * spanU;
    array[i + 1] = rect.v0 + array[i + 1]! * spanV;
  }
  uv.needsUpdate = true;
}

/**
 * A plane that samples one glyph, sized in world units and subdivided so
 * a displacement map can lift the ink off the tile it sits on.
 */
export function createGlyphGeometry(
  rect: GlyphRect,
  size: number,
  segments = 14,
): PlaneGeometry {
  const geometry = new PlaneGeometry(size, size, segments, segments);
  remapPlaneUvs(geometry, rect);
  return geometry;
}

export type GlyphAtlas = {
  /** Glyph shape as colour: white ink on transparency, or a colour emoji. */
  ink: CanvasTexture;
  /** Same shape as luminance on opaque black, for relief shading. */
  relief: CanvasTexture | null;
  symbols: string[];
  rects: GlyphRect[];
  dispose: () => void;
};

export type GlyphAtlasOptions = {
  /** True draws white numerals; false draws colour emoji. */
  mono: boolean;
  /** Pixels per atlas cell. 128 keeps a digit crisp at any board size. */
  cell?: number;
  fontFamily?: string;
  weight?: string;
  /** Fraction of the cell the glyph is allowed to fill. */
  fill?: number;
  anisotropy?: number;
};

const DEFAULT_FONT =
  '"DM Sans Variable", "DM Sans", system-ui, -apple-system, sans-serif';

/** The nine numerals, in digit order. */
export const DIGIT_SYMBOLS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * The glyphs an atlas has to hold for the current digit mode.
 *
 * A glyph is looked up by the symbol it draws, so the atlas and the
 * board have to agree: painting emoji into an atlas the board reads as
 * numerals leaves every digit sampling the same first cell.
 */
export function atlasSymbols(
  mono: boolean,
  emoji: readonly string[],
): string[] {
  if (mono) return DIGIT_SYMBOLS;
  return Array.from({ length: 9 }, (_, i) => emoji[i] || DIGIT_SYMBOLS[i]!);
}

/**
 * The glyph a digit draws: its own numeral, or the emoji themed for it.
 *
 * Notes are indexed by digit rather than by value, so this takes the
 * digit and the atlas's own symbol list — which is the emoji set in
 * emoji mode and the numerals otherwise.
 */
export function glyphSymbol(
  digit: number,
  mono: boolean,
  symbols: readonly string[],
): string {
  const symbol = mono ? null : symbols[digit - 1];
  return symbol || DIGIT_SYMBOLS[digit - 1] || String(digit);
}

/** Everything the painter needs, with every option already resolved. */
type PaintOptions = {
  mono: boolean;
  cell: number;
  cols: number;
  fontFamily: string;
  weight: string;
  fill: number;
};

function paintGlyphs(
  canvas: HTMLCanvasElement,
  symbols: string[],
  options: PaintOptions,
  background: string | null,
): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const { cell, cols, fontFamily, weight, fill, mono } = options;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (background) {
    // The relief atlas has to be opaque everywhere: transparent pixels
    // upload as undefined RGB and smear a displacement map.
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.fillStyle = mono ? "#ffffff" : "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${weight} ${Math.round(cell * fill)}px ${fontFamily}`;
  symbols.forEach((symbol, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    ctx.fillText(symbol, col * cell + cell / 2, row * cell + cell / 2);
  });
  return true;
}

/**
 * Builds a texture atlas of glyphs on a 2D canvas.
 *
 * Three's TextGeometry needs a typeface JSON that is not vendored here,
 * and a real font through a canvas keeps the exact numerals the rest of
 * the app uses — same family, same weight — which matters when a 3D
 * digit has to read as the same character as the numpad beside it.
 *
 * Returns null where no 2D context exists (a headless test run), letting
 * the caller fall back to the DOM board instead of painting nothing.
 */
export function buildGlyphAtlas(
  symbols: string[],
  options: GlyphAtlasOptions = { mono: true },
): GlyphAtlas | null {
  const cell = options.cell ?? 128;
  const cols = Math.max(1, Math.ceil(Math.sqrt(symbols.length)));
  const rows = Math.max(1, Math.ceil(symbols.length / cols));
  const resolved: PaintOptions = {
    mono: options.mono,
    cell,
    cols,
    fontFamily: options.fontFamily ?? DEFAULT_FONT,
    weight: options.weight ?? (options.mono ? "700" : "400"),
    fill: options.fill ?? (options.mono ? 0.86 : 0.72),
  };

  const inkCanvas = document.createElement("canvas");
  inkCanvas.width = cols * cell;
  inkCanvas.height = rows * cell;
  if (!paintGlyphs(inkCanvas, symbols, resolved, null)) return null;

  const ink = new CanvasTexture(inkCanvas);
  ink.colorSpace = SRGBColorSpace;
  // Mipmapping an atlas bleeds neighbouring glyphs into each other at
  // low levels; the board is drawn near screen size, so linear is enough.
  ink.generateMipmaps = false;
  ink.minFilter = LinearFilter;
  ink.magFilter = LinearFilter;
  if (options.anisotropy) ink.anisotropy = options.anisotropy;

  let relief: CanvasTexture | null = null;
  if (options.mono) {
    const reliefCanvas = document.createElement("canvas");
    reliefCanvas.width = cols * cell;
    reliefCanvas.height = rows * cell;
    if (paintGlyphs(reliefCanvas, symbols, resolved, "#000000")) {
      relief = new CanvasTexture(reliefCanvas);
      relief.generateMipmaps = false;
      relief.minFilter = LinearFilter;
      relief.magFilter = LinearFilter;
      if (options.anisotropy) relief.anisotropy = options.anisotropy;
    }
  }

  return {
    ink,
    relief,
    symbols,
    rects: glyphRects(symbols.length, cols),
    dispose: () => {
      ink.dispose();
      relief?.dispose();
    },
  };
}
