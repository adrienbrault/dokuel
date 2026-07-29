#!/usr/bin/env bun
/**
 * Renders the committed PWA/social PNGs in public/ from inline SVG:
 *
 *   public/icons/icon-192.png        manifest icon
 *   public/icons/icon-512.png        manifest icon
 *   public/icons/apple-touch-icon.png (180×180, iOS home screen)
 *   public/og-image.png              1200×630 link preview card
 *
 * The icons are pure geometry (no <text>) so they rasterize
 * identically on any machine. The og-image carries the wordmark and
 * renders with the host's sans fonts — it is a committed asset, not
 * rebuilt on CI, so font availability only matters where this script
 * is (re)run.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const PUBLIC = join(import.meta.dirname, "..", "public");
const ICONS = join(PUBLIC, "icons");
mkdirSync(ICONS, { recursive: true });

// Brand palette (matches --color-accent / bg tokens in src/index.css).
const TEAL = "#1a7a6d";
const TEAL_DEEP = "#135c52";
const MINT = "#a7e8d8"; // "you" cell
const CORAL = "#f6b26b"; // "opponent" cell — the 1v1 hint
const CREAM = "#fdfbf9";

/**
 * Full-bleed app icon. Maskable-safe: the background covers the whole
 * canvas and the board sits inside the center 80% safe zone. The two
 * tinted cells are the duel: two players racing one grid.
 */
function iconSvg(size: number): string {
  const s = size / 512; // authored at 512
  const inset = 106 * s;
  const board = 512 * s - inset * 2;
  const cell = board / 3;
  const thick = 22 * s;
  const thin = 12 * s;
  const x = (n: number) => inset + cell * n;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${TEAL}"/>
      <stop offset="1" stop-color="${TEAL_DEEP}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <rect x="${x(0)}" y="${x(0)}" width="${cell}" height="${cell}" fill="${MINT}"/>
  <rect x="${x(2)}" y="${x(2)}" width="${cell}" height="${cell}" fill="${CORAL}"/>
  <g stroke="${CREAM}" stroke-linecap="round">
    <rect x="${inset}" y="${inset}" width="${board}" height="${board}" rx="${18 * s}" fill="none" stroke-width="${thick}"/>
    <line x1="${x(1)}" y1="${inset}" x2="${x(1)}" y2="${inset + board}" stroke-width="${thin}"/>
    <line x1="${x(2)}" y1="${inset}" x2="${x(2)}" y2="${inset + board}" stroke-width="${thin}"/>
    <line x1="${inset}" y1="${x(1)}" x2="${inset + board}" y2="${x(1)}" stroke-width="${thin}"/>
    <line x1="${inset}" y1="${x(2)}" x2="${inset + board}" y2="${x(2)}" stroke-width="${thin}"/>
  </g>
</svg>`;
}

/** 1200×630 social card: wordmark + tagline left, duel board right. */
function ogSvg(): string {
  const boardX = 810;
  const boardY = 135;
  const board = 360;
  const cell = board / 3;
  const bx = (n: number) => boardX + cell * n;
  const by = (n: number) => boardY + cell * n;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${TEAL}"/>
      <stop offset="1" stop-color="${TEAL_DEEP}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <text x="96" y="300" font-family="DejaVu Sans, Verdana, sans-serif" font-weight="bold" font-size="120" fill="${CREAM}">Dokuel</text>
  <text x="98" y="378" font-family="DejaVu Sans, Verdana, sans-serif" font-size="44" fill="${MINT}">1v1 Sudoku Duel</text>
  <text x="98" y="452" font-family="DejaVu Sans, Verdana, sans-serif" font-size="30" fill="${CREAM}" opacity="0.85">Race a friend in real time — free, no account.</text>
  <rect x="${bx(0)}" y="${by(0)}" width="${cell}" height="${cell}" fill="${MINT}"/>
  <rect x="${bx(2)}" y="${by(2)}" width="${cell}" height="${cell}" fill="${CORAL}"/>
  <g stroke="${CREAM}" stroke-linecap="round">
    <rect x="${boardX}" y="${boardY}" width="${board}" height="${board}" rx="20" fill="none" stroke-width="22"/>
    <line x1="${bx(1)}" y1="${boardY}" x2="${bx(1)}" y2="${boardY + board}" stroke-width="12"/>
    <line x1="${bx(2)}" y1="${boardY}" x2="${bx(2)}" y2="${boardY + board}" stroke-width="12"/>
    <line x1="${boardX}" y1="${by(1)}" x2="${boardX + board}" y2="${by(1)}" stroke-width="12"/>
    <line x1="${boardX}" y1="${by(2)}" x2="${boardX + board}" y2="${by(2)}" stroke-width="12"/>
  </g>
</svg>`;
}

async function renderPng(svg: string, out: string): Promise<void> {
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log(`wrote ${out}`);
}

await renderPng(iconSvg(192), join(ICONS, "icon-192.png"));
await renderPng(iconSvg(512), join(ICONS, "icon-512.png"));
await renderPng(iconSvg(180), join(ICONS, "apple-touch-icon.png"));
await renderPng(ogSvg(), join(PUBLIC, "og-image.png"));
