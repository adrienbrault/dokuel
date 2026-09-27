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
  accent: Color;
  accentHot: Color;
  gold: Color;
  rival: Color;
  conflict: Color;
  tileBody: Color;
  tileMetalness: number;
  tileRoughness: number;
  tileGlyph: Color;
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
  accent: hex("#2eb88f", 1.6),
  accentHot: hex("#8ff5d6", 3),
  gold: hex("#f3b94c", 3),
  rival: hex("#fd6178", 2.2),
  conflict: hex("#ff3b3b", 2.6),
  tileBody: hex("#0a1012"),
  tileMetalness: 0.55,
  tileRoughness: 0.28,
  tileGlyph: hex("#49daac", 2.4),
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

export const LIGHT_PALETTE: ScenePalette = {
  skyZenith: hex("#dfeae6"),
  skyHorizon: hex("#fbf8f3"),
  horizonGlow: hex("#fff6e6"),
  fog: hex("#f3f1ec"),
  fogDensity: 0.02,
  floorBase: hex("#eeebe4"),
  gridMinor: hex("#d9e3de"),
  gridMajor: hex("#8fbfb1"),
  accent: hex("#009b74"),
  accentHot: hex("#00c795", 1.2),
  gold: hex("#e8a72e", 1.1),
  rival: hex("#f0445f"),
  conflict: hex("#e5322f"),
  tileBody: hex("#fbfaf7"),
  tileMetalness: 0.05,
  tileRoughness: 0.22,
  tileGlyph: hex("#0b8a69"),
  mote: hex("#ffffff"),
  shaft: hex("#fff3d6", 0.5),
  pillar: hex("#e4e1da"),
  pillarEdge: hex("#7fcab5"),
  stars: 0,
  exposure: 1,
  bloomStrength: 0.22,
  bloomRadius: 0.5,
  bloomThreshold: 0.92,
  vignette: 0.18,
  grain: 0.02,
  aberration: 0,
  additive: false,
  env: {
    background: hex("#f2efe9"),
    key: hex("#ffffff", 2.2),
    fill: hex("#bfe8dc", 1.4),
    warm: hex("#ffe2b0", 1.2),
  },
};
