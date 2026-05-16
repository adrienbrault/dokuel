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

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..");

// Where Playwright captures land locally + on the CI runner. Gitignored.
const SCREENSHOTS_DIR =
	process.env.SCREENSHOTS_DIR ?? join(REPO_ROOT, "e2e", "screenshots");

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

const DEVICE_ORDER = ["iPhone-SE", "iPhone-14", "iPad-Mini", "Desktop"];

const HERO_SCENES: { scene: string; device: string; alt: string }[] = [
	{ scene: "landing", device: "Desktop", alt: "Landing page" },
	{ scene: "solo-game", device: "iPhone-14", alt: "Solo game" },
	{
		scene: "multiplayer-progress-bars-dark",
		device: "Desktop",
		alt: "Multiplayer with live opponent progress (dark mode)",
	},
	{
		scene: "solo-game-dark",
		device: "iPhone-14",
		alt: "Solo game in dark mode",
	},
];

type Shot = { file: string; scene: string; device: string };

function listShots(): Shot[] {
	if (!existsSync(SCREENSHOTS_DIR)) {
		throw new Error(
			`No screenshots found at ${SCREENSHOTS_DIR}. Run 'bun run screenshots' first.`,
		);
	}
	return readdirSync(SCREENSHOTS_DIR)
		.filter((f) => f.endsWith(".png"))
		.map((file) => {
			const base = file.replace(/\.png$/, "");
			const sepIdx = base.lastIndexOf("--");
			if (sepIdx === -1) {
				throw new Error(`Unexpected screenshot filename: ${file}`);
			}
			return {
				file,
				scene: base.slice(0, sepIdx),
				device: base.slice(sepIdx + 2),
			};
		});
}

function titleCase(s: string): string {
	return s
		.split("-")
		.map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
		.join(" ");
}

function deviceLabel(d: string): string {
	return d.replace(/-/g, " ");
}

function sceneLabel(scene: string): string {
	const overrides: Record<string, string> = {
		landing: "Landing",
		"landing-dark": "Landing (dark)",
		"solo-game": "Solo game",
		"solo-game-dark": "Solo game (dark)",
		"solo-numpad-left": "Solo · numpad left",
		"solo-numpad-right": "Solo · numpad right",
		"solo-in-progress": "Solo · in progress",
		"solo-win-modal": "Solo · win modal",
		"solo-settings-popover": "Solo · settings popover",
		difficulty: "Difficulty picker",
		"difficulty-dark": "Difficulty picker (dark)",
		"daily-challenge": "Daily challenge",
		"join-game": "Join game",
		"multiplayer-lobby": "Multiplayer · lobby",
		"multiplayer-progress-bars": "Multiplayer · progress bars",
		"multiplayer-progress-bars-dark": "Multiplayer · progress bars (dark)",
		"multiplayer-progress-hidden": "Multiplayer · progress hidden",
		"multiplayer-settings-toggle": "Multiplayer · settings toggle",
	};
	return overrides[scene] ?? titleCase(scene);
}

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
			`    <td align="center" valign="top"><img src="${url(file)}" alt="${alt}" width="180" /></td>`,
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

function renderMatrix(shots: Shot[]): string {
	const byScene = new Map<string, Map<string, string>>();
	const devices = new Set<string>();
	for (const { scene, device, file } of shots) {
		if (!byScene.has(scene)) byScene.set(scene, new Map());
		byScene.get(scene)?.set(device, file);
		devices.add(device);
	}

	const sortedDevices = [...devices].sort((a, b) => {
		const ai = DEVICE_ORDER.indexOf(a);
		const bi = DEVICE_ORDER.indexOf(b);
		return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
	});

	const sortedScenes = [...byScene.keys()].sort();

	const header = `| Scene | ${sortedDevices.map(deviceLabel).join(" | ")} |`;
	const sep = `| --- | ${sortedDevices.map(() => "---").join(" | ")} |`;

	const rows = sortedScenes.map((scene) => {
		const row = byScene.get(scene);
		if (!row) return "";
		const cells = sortedDevices.map((d) => {
			const file = row.get(d);
			if (!file) return "—";
			return `<a href="${url(file)}"><img src="${url(file)}" width="160" alt="${sceneLabel(scene)} on ${deviceLabel(d)}" /></a>`;
		});
		return `| **${sceneLabel(scene)}** | ${cells.join(" | ")} |`;
	});

	return [
		"<details>",
		`<summary>All ${sortedScenes.length} scenes × ${sortedDevices.length} devices</summary>`,
		"",
		header,
		sep,
		...rows,
		"",
		"</details>",
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

	const readme = readFileSync(README_PATH, "utf-8");
	const withHero = replaceBlock(readme, HERO_START, HERO_END, renderHero(shots));
	const withMatrix = replaceBlock(
		withHero,
		MATRIX_START,
		MATRIX_END,
		renderMatrix(shots),
	);

	if (withMatrix === readme) {
		console.log("README.md screenshot sections unchanged.");
		return;
	}
	writeFileSync(README_PATH, withMatrix);
	console.log(
		`README.md updated: ${shots.length} screenshots across ${
			new Set(shots.map((s) => s.scene)).size
		} scenes.`,
	);
}

main();
