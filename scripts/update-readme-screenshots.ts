#!/usr/bin/env bun
/**
 * Rewrites the screenshot sections of README.md from the PNGs in
 * the (gitignored) capture directory. Emits absolute URLs pointing
 * at the GitHub Pages site that hosts the PNGs — the workflow at
 * .github/workflows/screenshots.yml force-publishes them to the
 * `gh-pages` branch on every push to main, so they never live in
 * main's history.
 *
 * Markers in README.md (kept verbatim, only the body is rewritten):
 *   <!-- hero-screenshots:start --> ... <!-- hero-screenshots:end -->
 *   <!-- screenshot-matrix:start --> ... <!-- screenshot-matrix:end -->
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	type CombinedSheet,
	DEVICE_ORDER,
	deviceLabel,
	listCombinedSheets,
	listShots,
	type Shot,
} from "./screenshot-meta.ts";

const REPO_ROOT = join(import.meta.dirname, "..");

// Public URL the PNGs are served from. The workflow pushes them to the
// `gh-pages` branch; GitHub Pages serves it at this origin.
const BASE_URL = (
	process.env.SCREENSHOTS_BASE_URL ?? "https://adrienbrault.github.io/dokuel"
).replace(/\/$/, "");

const README_PATH = join(REPO_ROOT, "README.md");

const HERO_START = "<!-- hero-screenshots:start -->";
const HERO_END = "<!-- hero-screenshots:end -->";
const MATRIX_START = "<!-- screenshot-matrix:start -->";
const MATRIX_END = "<!-- screenshot-matrix:end -->";

const HERO_SCENES: { scene: string; device: string; alt: string }[] = [
	{ scene: "landing", device: "iPhone-14", alt: "Landing page" },
	{ scene: "solo-game", device: "iPhone-14", alt: "Solo game" },
	{
		scene: "solo-game-dark",
		device: "iPhone-14",
		alt: "Solo game in dark mode",
	},
];

function url(file: string): string {
	return `${BASE_URL}/${file}`;
}

function renderHero(shots: Shot[]): string {
	// Use a <table> for the hero strip: GitHub's markdown parser otherwise
	// often splits each <img> onto its own paragraph, stacking them
	// vertically. Cells in a single <tr> are guaranteed side-by-side.
	const present = new Set(shots.map((s) => `${s.scene}--${s.device}`));
	const cells: string[] = [];
	for (const { scene, device, alt } of HERO_SCENES) {
		const key = `${scene}--${device}`;
		if (!present.has(key)) continue;
		const file = `${scene}--${device}.png`;
		cells.push(
			`    <td align="center" valign="top"><img src="${url(file)}" alt="${alt}" width="220" /></td>`,
		);
	}
	return [
		'<table align="center">',
		"  <tr>",
		...cells,
		"  </tr>",
		"</table>",
	].join("\n");
}

function combinedUrl(file: string): string {
	return `${BASE_URL}/combined/${file}`;
}

const DEVICE_PART_TITLES = {
	a: "Menus & entry",
	b: "Active gameplay",
};

const FEATURE_TITLES: Record<string, string> = {
	onboarding: "Onboarding & landing",
	solo: "Solo gameplay",
	numpad: "Numpad positions",
	multiplayer: "Multiplayer",
	"dark-mode-a": "Dark-mode pairs (landing & solo)",
	"dark-mode-b": "Dark-mode pairs (difficulty & multiplayer)",
};

function parseDeviceSheet(file: string): { device: string; part: string } {
	// device--<Device>--<part>.png  (Device may contain '-', e.g. iPad-Mini)
	const base = file.replace(/^device--/, "").replace(/\.png$/, "");
	const lastDash = base.lastIndexOf("--");
	return {
		device: base.slice(0, lastDash),
		part: base.slice(lastDash + 2),
	};
}

function renderCombined(sheets: CombinedSheet[]): string {
	const deviceSheets = sheets.filter((s) => s.kind === "device");
	const featureSheets = sheets.filter((s) => s.kind === "feature");

	// Per-device table: rows = devices in canonical order, cols = part a/b.
	const byDevice = new Map<string, Map<string, string>>();
	for (const { file } of deviceSheets) {
		const { device, part } = parseDeviceSheet(file);
		if (!byDevice.has(device)) byDevice.set(device, new Map());
		byDevice.get(device)?.set(part, file);
	}
	const sortedDevices = [...byDevice.keys()].sort((a, b) => {
		const ai = DEVICE_ORDER.indexOf(a);
		const bi = DEVICE_ORDER.indexOf(b);
		return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
	});

	const deviceRows = sortedDevices.map((d) => {
		const parts = byDevice.get(d);
		const aCell = parts?.get("a");
		const bCell = parts?.get("b");
		const cell = (file: string | undefined, partLabel: string): string => {
			if (!file) return '    <td align="center">—</td>';
			return `    <td align="center"><a href="${combinedUrl(file)}"><img src="${combinedUrl(file)}" width="320" alt="${deviceLabel(d)} · ${partLabel}" /></a></td>`;
		};
		return [
			"  <tr>",
			`    <th align="left">${deviceLabel(d)}</th>`,
			cell(aCell, DEVICE_PART_TITLES.a),
			cell(bCell, DEVICE_PART_TITLES.b),
			"  </tr>",
		].join("\n");
	});

	const deviceTable = [
		"<table>",
		"  <thead>",
		"    <tr>",
		'      <th align="left">Device</th>',
		`      <th align="center">${DEVICE_PART_TITLES.a}</th>`,
		`      <th align="center">${DEVICE_PART_TITLES.b}</th>`,
		"    </tr>",
		"  </thead>",
		"  <tbody>",
		...deviceRows,
		"  </tbody>",
		"</table>",
	].join("\n");

	// Per-feature: stack each sheet full-width (they have varying aspects).
	const featureOrder = Object.keys(FEATURE_TITLES);
	const orderedFeatures = [...featureSheets].sort((a, b) => {
		const aKey = a.file.replace(/^feature--/, "").replace(/\.png$/, "");
		const bKey = b.file.replace(/^feature--/, "").replace(/\.png$/, "");
		const ai = featureOrder.indexOf(aKey);
		const bi = featureOrder.indexOf(bKey);
		return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
	});

	const featureBlocks = orderedFeatures.map(({ file }) => {
		const key = file.replace(/^feature--/, "").replace(/\.png$/, "");
		const title = FEATURE_TITLES[key] ?? key;
		return [
			`#### ${title}`,
			"",
			`<a href="${combinedUrl(file)}"><img src="${combinedUrl(file)}" width="800" alt="${title}" /></a>`,
		].join("\n");
	});

	return [
		"### Per-device",
		"",
		"Each device gets two sheets: menus & entry (landing, difficulty, daily challenge, join, solo entry, multiplayer lobby) and active gameplay (in-progress, win modal, settings popover, numpad variants, multiplayer progress).",
		"",
		deviceTable,
		"",
		"### Per-feature",
		"",
		"Each feature sheet shows related scenes across all 4 devices (devices as rows).",
		"",
		featureBlocks.join("\n\n"),
	].join("\n");
}

function replaceBlock(
	content: string,
	start: string,
	end: string,
	body: string,
): string {
	const startIdx = content.indexOf(start);
	const endIdx = content.indexOf(end);
	if (startIdx === -1 || endIdx === -1) {
		throw new Error(
			`README.md is missing required markers: ${start} / ${end}`,
		);
	}
	return `${content.slice(0, startIdx + start.length)}\n${body}\n${content.slice(endIdx)}`;
}

function main(): void {
	const shots = listShots();
	if (shots.length === 0) {
		throw new Error("No screenshots found — nothing to update.");
	}
	const sheets = listCombinedSheets();
	if (sheets.length === 0) {
		throw new Error(
			"No combined sheets found — run 'bun run screenshots:combine' first.",
		);
	}

	const readme = readFileSync(README_PATH, "utf-8");
	const withHero = replaceBlock(readme, HERO_START, HERO_END, renderHero(shots));
	const withMatrix = replaceBlock(
		withHero,
		MATRIX_START,
		MATRIX_END,
		renderCombined(sheets),
	);

	if (withMatrix === readme) {
		console.log("README.md screenshot sections unchanged.");
		return;
	}
	writeFileSync(README_PATH, withMatrix);
	console.log(
		`README.md updated: ${shots.length} screenshots, ${sheets.length} combined sheets.`,
	);
}

main();
