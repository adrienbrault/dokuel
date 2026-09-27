import { Color } from "three";

/**
 * Everything the scene paints with, per theme. Hexes are sRGB; three
 * converts them to linear on the way in. Values above 1 (via
 * multiplyScalar) are HDR and feed bloom.
 *
 * Dark is a night arena lit by the board: obsidian, teal light, fog.
 * Light is the same place at dawn: porcelain, ink-teal lines, mist.
 */
export type ScenePalette = {
  skyZenith: Color;
  skyHorizon: Color;
  /** Glow band where the floor meets the sky. */
  horizonGlow: Color;
  fog: Color;
  fogDensity: number;
  floorBase: Color;
  gridMinor: Color;
  gridMajor: Color;
  /** How hard the grid is drawn: glow on dark adds up fast, ink does not. */
  gridGain: number;
  /** Sky height (0..1 up the dome) where the zenith color takes over. */
  skyRise: number;
  accent: Color;
  accentHot: Color;
  gold: Color;
  rival: Color;
  conflict: Color;
  tileBody: Color;
  tileMetalness: number;
  tileRoughness: number;
  tileGlyph: Color;
  /** What a tile's numeral flares to when its digit is played. */
  tileGlow: Color;
  mote: Color;
  shaft: Color;
  pillar: Color;
  pillarEdge: Color;
  stars: number;
  exposure: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  vignette: number;
  grain: number;
  /** Chromatic fringing toward the corners. */
  aberration: number;
  /** Glows add light on a dark world; on a light one they would vanish. */
  additive: boolean;
  /** Environment used for reflections on the tiles. */
  env: { background: Color; key: Color; fill: Color; warm: Color };
};

const hex = (value: string, scale = 1) =>
  new Color(value).multiplyScalar(scale);

export const DARK_PALETTE: ScenePalette = {
  skyZenith: hex("#010304"),
  skyHorizon: hex("#06191a"),
  horizonGlow: hex("#0f4a42"),
  fog: hex("#041011"),
  fogDensity: 0.022,
  floorBase: hex("#020607"),
  gridMinor: hex("#0c3f36", 0.5),
  gridMajor: hex("#1fae8c", 0.42),
  gridGain: 1,
  skyRise: 0.6,
  accent: hex("#2eb88f", 1.6),
  accentHot: hex("#8ff5d6", 3),
  gold: hex("#f3b94c", 3),
  rival: hex("#fd6178", 2.2),
  conflict: hex("#ff3b3b", 2.6),
  tileBody: hex("#0a1012"),
  tileMetalness: 0.55,
  tileRoughness: 0.28,
  tileGlyph: hex("#49daac", 2.4),
  tileGlow: hex("#8ff5d6", 3),
  mote: hex("#9ff3dc", 1.6),
  shaft: hex("#49daac", 0.9),
  pillar: hex("#050a0b"),
  pillarEdge: hex("#2eb88f", 2.2),
  stars: 1,
  exposure: 1.05,
  bloomStrength: 0.95,
  bloomRadius: 0.62,
  bloomThreshold: 0.55,
  vignette: 0.55,
  grain: 0.045,
  aberration: 0.005,
  additive: true,
  env: {
    background: hex("#010203"),
    key: hex("#d8fff3", 3),
    fill: hex("#1fae8c", 2.5),
    warm: hex("#f3b94c", 1.2),
  },
};

/**
 * Light is not night with the lights on: a pale copy of the dark world
 * reads as a grey void behind white cards. It is its own time of day,
 * golden hour: a teal sky warming to a sunlit horizon, a sandstone floor
 * inked with deep teal lines, jade tiles, stone monoliths catching the
 * sun. Mid-tones everywhere, so white glass surfaces stand out on it.
 */
export const LIGHT_PALETTE: ScenePalette = {
  skyZenith: hex("#4f9fae"),
  skyHorizon: hex("#f3dfbf"),
  horizonGlow: hex("#ffcf8f"),
  fog: hex("#ecd8b8"),
  fogDensity: 0.015,
  floorBase: hex("#c8b89c"),
  gridMinor: hex("#8c7a5c"),
  gridMajor: hex("#0f5546"),
  gridGain: 1.9,
  skyRise: 0.32,
  accent: hex("#00a07a"),
  accentHot: hex("#00c795"),
  gold: hex("#e0921a"),
  rival: hex("#e2345a"),
  conflict: hex("#e02f2c"),
  tileBody: hex("#1f7d67"),
  tileMetalness: 0.12,
  tileRoughness: 0.2,
  tileGlyph: hex("#fff3d8"),
  tileGlow: hex("#ffd36b"),
  mote: hex("#fff0c4"),
  shaft: hex("#fff0c8", 0.9),
  pillar: hex("#aab3ae"),
  pillarEdge: hex("#ffe0a0", 1.3),
  stars: 0,
  exposure: 1.08,
  bloomStrength: 0.38,
  bloomRadius: 0.55,
  bloomThreshold: 0.82,
  vignette: 0.3,
  grain: 0.025,
  aberration: 0,
  additive: false,
  env: {
    background: hex("#d6c4a4"),
    key: hex("#fff6e0", 2.4),
    fill: hex("#8fd6c4", 1.4),
    warm: hex("#ffcf8a", 1.6),
  },
};
