import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SOURCE_DIR = join(ROOT, "public", "ui-assets");
const OUT_DIR = join(SOURCE_DIR, "sprites");

const svgSources = [
  ["assist-tabs", "assist-level-tabs.svg"],
  ["board-pattern-tile", "board-pattern-tile.svg"],
  ["daily-badge", "daily-badge.svg"],
  ["dokuel-mark", "dokuel-mark.svg"],
  ["duel-badge", "duel-badge.svg"],
  ["empty-board", "empty-state-board.svg"],
  ["hint-token", "hint-token.svg"],
  ["progress-ribbon", "progress-ribbon.svg"],
  ["room-code", "room-code-ornament.svg"],
  ["streak-token", "streak-token.svg"],
  ["victory-medal", "victory-medal.svg"],
] as const;

const generatedSources = {
  "join-token": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect x="28" y="28" width="104" height="104" rx="28" fill="#d7f5e7"/><rect x="48" y="50" width="46" height="60" rx="14" fill="#fffaf2" stroke="#d7d0c4" stroke-width="4"/><path d="M82 80h34m-16-16 16 16-16 16" fill="none" stroke="#0a9878" stroke-linecap="round" stroke-linejoin="round" stroke-width="10"/><circle cx="63" cy="80" r="5" fill="#ffd27f"/></svg>`,
  "solo-token": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect x="24" y="24" width="112" height="112" rx="30" fill="#fffaf2" stroke="#d7d0c4" stroke-width="4"/><g stroke="#d8d0c2" stroke-width="3"><path d="M60 38v84M100 38v84M38 60h84M38 100h84"/></g><circle cx="80" cy="80" r="24" fill="#0a9878"/><path d="m73 66 26 14-26 14V66Z" fill="#fffaf2"/></svg>`,
  "erase-token": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect x="24" y="36" width="112" height="88" rx="24" fill="#fffaf2" stroke="#d7d0c4" stroke-width="4"/><path d="m55 90 33-33 28 28-28 28H62L55 90Z" fill="#f0ebe3" stroke="#706a61" stroke-linejoin="round" stroke-width="6"/><path d="M80 65 108 93M57 113h56" stroke="#0a9878" stroke-linecap="round" stroke-width="7"/></svg>`,
  "undo-token": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect x="24" y="24" width="112" height="112" rx="32" fill="#fffaf2" stroke="#d7d0c4" stroke-width="4"/><path d="M66 58 44 80l22 22M48 80h42c18 0 29 10 29 25" fill="none" stroke="#0a9878" stroke-linecap="round" stroke-linejoin="round" stroke-width="10"/><circle cx="106" cy="58" r="8" fill="#ffd27f"/></svg>`,
  "stats-token": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect x="26" y="28" width="108" height="104" rx="28" fill="#fffaf2" stroke="#d7d0c4" stroke-width="4"/><rect x="52" y="88" width="14" height="22" rx="5" fill="#0a9878"/><rect x="74" y="68" width="14" height="42" rx="5" fill="#ffd27f"/><rect x="96" y="52" width="14" height="58" rx="5" fill="#ff7a59"/><path d="M48 112h66" stroke="#706a61" stroke-linecap="round" stroke-width="6"/></svg>`,
  "settings-token": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect x="28" y="28" width="104" height="104" rx="30" fill="#fffaf2" stroke="#d7d0c4" stroke-width="4"/><circle cx="80" cy="80" r="18" fill="#0a9878"/><g stroke="#706a61" stroke-linecap="round" stroke-width="8"><path d="M80 45v14M80 101v14M45 80h14M101 80h14M55 55l10 10M95 95l10 10M105 55 95 65M65 95l-10 10"/></g><circle cx="80" cy="80" r="7" fill="#fffaf2"/></svg>`,
  "medium-flame": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect x="28" y="28" width="104" height="104" rx="30" fill="#fff3d7"/><path d="M82 45c5 18-12 21-2 36 6-11 17-15 18-29 14 15 21 33 11 50-9 16-27 22-44 15-16-7-24-22-19-37 4-13 15-19 23-32 5 10 6 18 2 26 12-9 11-20 11-29Z" fill="#ff8a4d"/><path d="M78 83c10 11 11 25 1 32-8-5-13-11-11-21 2-6 6-8 10-11Z" fill="#fffaf2"/></svg>`,
  "expert-spark": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect x="28" y="28" width="104" height="104" rx="30" fill="#ffe1e8"/><path d="M80 42 90 70l30 10-30 10-10 28-10-28-30-10 30-10 10-28Z" fill="#ff5f86"/><circle cx="52" cy="52" r="7" fill="#0a9878"/><circle cx="108" cy="108" r="7" fill="#ffd27f"/></svg>`,
};

const TILE = 192;

function svgBuffer(name: string, file?: string) {
  if (file) return readFileSync(join(SOURCE_DIR, file));
  const source = generatedSources[name as keyof typeof generatedSources];
  if (!source) throw new Error(`Unknown generated sprite ${name}`);
  return Buffer.from(source);
}

async function renderPng(name: string, svg: Buffer) {
  const png = await sharp(svg)
    .resize(TILE, TILE, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const outPath = join(OUT_DIR, `${name}.png`);
  writeFileSync(outPath, png);
  return { name, outPath, png };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const entries = [
    ...svgSources.map(([name, file]) => ({ name, svg: svgBuffer(name, file) })),
    ...Object.keys(generatedSources).map((name) => ({ name, svg: svgBuffer(name) })),
  ];

  const rendered = await Promise.all(entries.map((entry) => renderPng(entry.name, entry.svg)));
  const columns = 6;
  const rows = Math.ceil(rendered.length / columns);
  const composites = rendered.map((entry, index) => ({
    input: entry.png,
    left: (index % columns) * TILE,
    top: Math.floor(index / columns) * TILE,
  }));

  await sharp({
    create: {
      width: columns * TILE,
      height: rows * TILE,
      channels: 4,
      background: "#00000000",
    },
  })
    .composite(composites)
    .png()
    .toFile(join(OUT_DIR, "ui-spritesheet.png"));

  const manifest = rendered.map((entry, index) => ({
    name: entry.name,
    file: basename(entry.outPath),
    sheet: "ui-spritesheet.png",
    x: (index % columns) * TILE,
    y: Math.floor(index / columns) * TILE,
    width: TILE,
    height: TILE,
  }));
  writeFileSync(join(OUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

await main();
