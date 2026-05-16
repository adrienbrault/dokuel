#!/usr/bin/env bun
/**
 * Produces contact sheets that combine the individual scene PNGs into
 * a small set of agent-friendly summary images written to
 * `e2e/screenshots/combined/`. Two flavours:
 *
 *   device--<Device>--<part>.png  9 scenes for one device per sheet (3×3).
 *                                 Each device is split into two thematic
 *                                 halves so per-cell pixel budget stays
 *                                 high enough for an agent to read text
 *                                 and spot small layout issues after the
 *                                 vision pipeline downscales the sheet.
 *   feature--<group>.png          related scenes × all devices, devices
 *                                 as rows. The dark-mode pairs are split
 *                                 across two sheets for the same reason.
 *
 * The individual PNGs in `e2e/screenshots/` are left untouched. The
 * combined directory is gitignored alongside everything else under
 * `e2e/screenshots/`.
 */

import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import {
	COMBINED_DIR,
	DEVICE_ORDER,
	deviceLabel,
	listShots,
	sceneLabel,
	SCREENSHOTS_DIR,
	type Shot,
} from "./screenshot-meta.ts";

const CELL_WIDTH = 320;
const LABEL_HEIGHT = 24;
const HEADER_HEIGHT = 32;
const GUTTER = 8;
const DEVICE_COLS = 3;
const BG = { r: 26, g: 26, b: 26, alpha: 1 };
const BG_HEX = "#1a1a1a";

const DEVICE_PARTS: { part: string; title: string; scenes: string[] }[] = [
	{
		part: "a",
		title: "Menus & entry",
		scenes: [
			"landing",
			"landing-dark",
			"difficulty",
			"difficulty-dark",
			"daily-challenge",
			"join-game",
			"solo-game",
			"solo-game-dark",
			"multiplayer-lobby",
		],
	},
	{
		part: "b",
		title: "Active gameplay",
		scenes: [
			"solo-in-progress",
			"solo-win-modal",
			"solo-settings-popover",
			"solo-numpad-left",
			"solo-numpad-right",
			"multiplayer-progress-bars",
			"multiplayer-progress-bars-dark",
			"multiplayer-progress-hidden",
			"multiplayer-settings-toggle",
		],
	},
];

const FEATURE_GROUPS: { name: string; title: string; scenes: string[] }[] = [
	{
		name: "onboarding",
		title: "Onboarding & landing",
		scenes: [
			"landing",
			"landing-dark",
			"difficulty",
			"difficulty-dark",
			"daily-challenge",
			"join-game",
		],
	},
	{
		name: "solo",
		title: "Solo gameplay",
		scenes: [
			"solo-game",
			"solo-game-dark",
			"solo-in-progress",
			"solo-win-modal",
			"solo-settings-popover",
		],
	},
	{
		name: "numpad",
		title: "Numpad positions",
		scenes: ["solo-game", "solo-numpad-left", "solo-numpad-right"],
	},
	{
		name: "multiplayer",
		title: "Multiplayer",
		scenes: [
			"multiplayer-lobby",
			"multiplayer-progress-bars",
			"multiplayer-progress-bars-dark",
			"multiplayer-progress-hidden",
			"multiplayer-settings-toggle",
		],
	},
	{
		name: "dark-mode-a",
		title: "Dark-mode pairs (landing & solo)",
		scenes: [
			"landing",
			"landing-dark",
			"solo-game",
			"solo-game-dark",
		],
	},
	{
		name: "dark-mode-b",
		title: "Dark-mode pairs (difficulty & multiplayer)",
		scenes: [
			"difficulty",
			"difficulty-dark",
			"multiplayer-progress-bars",
			"multiplayer-progress-bars-dark",
		],
	},
];

type Cell = {
	buf: Buffer;
	width: number;
	height: number;
};

function xmlEscape(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function labelSvg(text: string, width: number): Buffer {
	const safe = xmlEscape(text);
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${LABEL_HEIGHT}">
  <rect width="100%" height="100%" fill="#0d0d0d"/>
  <text x="8" y="16" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="12" fill="#e6e6e6">${safe}</text>
</svg>`;
	return Buffer.from(svg);
}

function headerSvg(text: string, width: number): Buffer {
	const safe = xmlEscape(text);
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEADER_HEIGHT}">
  <rect width="100%" height="100%" fill="${BG_HEX}"/>
  <text x="12" y="22" font-family="ui-sans-serif, system-ui, sans-serif" font-size="16" font-weight="600" fill="#ffffff">${safe}</text>
</svg>`;
	return Buffer.from(svg);
}

async function buildCell(shot: Shot, label: string): Promise<Cell> {
	const inputPath = join(SCREENSHOTS_DIR, shot.file);
	const resized = await sharp(inputPath)
		.resize({ width: CELL_WIDTH, fit: "inside" })
		.png()
		.toBuffer({ resolveWithObject: true });

	const cellW = resized.info.width;
	const cellH = resized.info.height + LABEL_HEIGHT;

	const buf = await sharp({
		create: {
			width: cellW,
			height: cellH,
			channels: 4,
			background: BG,
		},
	})
		.composite([
			{ input: labelSvg(label, cellW), top: 0, left: 0 },
			{ input: resized.data, top: LABEL_HEIGHT, left: 0 },
		])
		.png()
		.toBuffer();

	return { buf, width: cellW, height: cellH };
}

async function writeSheet(
	outName: string,
	title: string,
	rows: Cell[][],
): Promise<void> {
	const colCount = Math.max(...rows.map((r) => r.length));
	const colWidths = new Array<number>(colCount).fill(0);
	for (const row of rows) {
		for (let c = 0; c < row.length; c++) {
			colWidths[c] = Math.max(colWidths[c], row[c].width);
		}
	}
	const rowHeights = rows.map((row) =>
		row.reduce((m, c) => Math.max(m, c.height), 0),
	);

	const sheetW =
		colWidths.reduce((a, b) => a + b, 0) + GUTTER * (colCount + 1);
	const sheetH =
		HEADER_HEIGHT +
		rowHeights.reduce((a, b) => a + b, 0) +
		GUTTER * (rows.length + 1);

	const composites: sharp.OverlayOptions[] = [
		{ input: headerSvg(title, sheetW), top: 0, left: 0 },
	];

	let y = HEADER_HEIGHT + GUTTER;
	for (let r = 0; r < rows.length; r++) {
		let x = GUTTER;
		for (let c = 0; c < rows[r].length; c++) {
			const cell = rows[r][c];
			// Center cell within its column slot if narrower than the slot.
			const slotW = colWidths[c];
			const offsetX = x + Math.floor((slotW - cell.width) / 2);
			composites.push({ input: cell.buf, top: y, left: offsetX });
			x += slotW + GUTTER;
		}
		y += rowHeights[r] + GUTTER;
	}

	const outPath = join(COMBINED_DIR, outName);
	await sharp({
		create: {
			width: sheetW,
			height: sheetH,
			channels: 4,
			background: BG,
		},
	})
		.composite(composites)
		.png()
		.toFile(outPath);
}

function shotIndex(shots: Shot[]): Map<string, Shot> {
	const idx = new Map<string, Shot>();
	for (const s of shots) idx.set(`${s.scene}--${s.device}`, s);
	return idx;
}

async function buildDevicePartSheet(
	device: string,
	part: { part: string; title: string; scenes: string[] },
	idx: Map<string, Shot>,
): Promise<void> {
	const scenes = part.scenes.filter((scene) =>
		idx.has(`${scene}--${device}`),
	);
	if (scenes.length === 0) return;

	const cells: Cell[] = [];
	for (const scene of scenes) {
		const shot = idx.get(`${scene}--${device}`);
		if (!shot) continue;
		cells.push(await buildCell(shot, sceneLabel(scene)));
	}

	const rows: Cell[][] = [];
	for (let i = 0; i < cells.length; i += DEVICE_COLS) {
		rows.push(cells.slice(i, i + DEVICE_COLS));
	}

	await writeSheet(
		`device--${device}--${part.part}.png`,
		`Per-device · ${deviceLabel(device)} · ${part.title}`,
		rows,
	);
}

async function buildFeatureSheet(
	group: { name: string; title: string; scenes: string[] },
	idx: Map<string, Shot>,
	devices: string[],
): Promise<void> {
	// Devices as rows, scenes as columns — uniform cell height within a row.
	const rows: Cell[][] = [];
	for (const device of devices) {
		const row: Cell[] = [];
		for (const scene of group.scenes) {
			const shot = idx.get(`${scene}--${device}`);
			if (!shot) continue;
			row.push(
				await buildCell(shot, `${scene} · ${deviceLabel(device)}`),
			);
		}
		if (row.length > 0) rows.push(row);
	}
	if (rows.length === 0) return;

	await writeSheet(
		`feature--${group.name}.png`,
		`Feature · ${group.title}`,
		rows,
	);
}

async function main(): Promise<void> {
	const shots = listShots();
	if (shots.length === 0) {
		throw new Error("No screenshots found — nothing to combine.");
	}
	// Clean stale sheets so renamed/removed sheet definitions don't linger.
	rmSync(COMBINED_DIR, { recursive: true, force: true });
	mkdirSync(COMBINED_DIR, { recursive: true });

	const idx = shotIndex(shots);
	const devicesPresent = DEVICE_ORDER.filter((d) =>
		shots.some((s) => s.device === d),
	);

	const work: Promise<void>[] = [];
	for (const device of devicesPresent) {
		for (const part of DEVICE_PARTS) {
			work.push(buildDevicePartSheet(device, part, idx));
		}
	}
	for (const group of FEATURE_GROUPS) {
		work.push(buildFeatureSheet(group, idx, devicesPresent));
	}
	await Promise.all(work);

	const sheetCount =
		devicesPresent.length * DEVICE_PARTS.length + FEATURE_GROUPS.length;
	console.log(
		`Combined ${shots.length} screenshots into ${sheetCount} sheets at ${COMBINED_DIR}`,
	);
}

await main();
