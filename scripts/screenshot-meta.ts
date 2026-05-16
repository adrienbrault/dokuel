/**
 * Shared metadata + filesystem helpers for screenshot-related scripts.
 * Imported by `update-readme-screenshots.ts` and `combine-screenshots.ts`.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..");

export const SCREENSHOTS_DIR =
	process.env.SCREENSHOTS_DIR ?? join(REPO_ROOT, "e2e", "screenshots");

export const COMBINED_DIR = join(SCREENSHOTS_DIR, "combined");

export const DEVICE_ORDER = ["iPhone-SE", "iPhone-14", "iPad-Mini", "Desktop"];

export type Shot = { file: string; scene: string; device: string };

/**
 * Lists individual scene PNGs in SCREENSHOTS_DIR. Filenames produced by
 * combine-screenshots.ts (`device--*.png`, `feature--*.png`) live in the
 * `combined/` subdirectory and are not picked up by readdir at this level —
 * but we also defensively skip them by prefix in case the layout changes.
 */
export function listShots(): Shot[] {
	if (!existsSync(SCREENSHOTS_DIR)) {
		throw new Error(
			`No screenshots found at ${SCREENSHOTS_DIR}. Run 'bun run screenshots' first.`,
		);
	}
	return readdirSync(SCREENSHOTS_DIR)
		.filter((f) => f.endsWith(".png"))
		.filter((f) => !f.startsWith("device--") && !f.startsWith("feature--"))
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

export function deviceLabel(d: string): string {
	return d.replace(/-/g, " ");
}

export function sceneLabel(scene: string): string {
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
